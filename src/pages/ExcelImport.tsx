import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, FileSpreadsheet, Check, AlertCircle, RefreshCw, PlusCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface CostEntry {
  vendorName: string;
  itemName: string;
  amount: number;
  paymentMonth: string;
}

interface ParsedData {
  projectNumber: string;
  projectName: string;
  customerName: string;
  salesAmount: number;
  costs: CostEntry[];
  existingProjectId: string | null;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => 2023 + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function ExcelImport() {
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(10);
  const [fileBuffer, setFileBuffer] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setDone(false);
    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = new Uint8Array(ev.target?.result as ArrayBuffer);
      setFileBuffer(buf);
      parseBuf(buf, startYear, startMonth);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleStartChange(year: number, month: number) {
    setStartYear(year);
    setStartMonth(month);
    if (fileBuffer) parseBuf(fileBuffer, year, month);
  }

  async function parseBuf(buf: Uint8Array, year: number, _month: number) {
    setParsed(null);
    setError("");
    setDone(false);

    try {
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { setError("シートが見つかりません"); return; }

      const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const projectNumber = String(rows[1]?.[12] ?? "").trim(); // M2
      const projectName = String(rows[3]?.[3] ?? "").trim();     // D4
      const customerName = String(rows[4]?.[3] ?? "").trim();    // D5
      const salesAmount = Number(rows[8]?.[6] ?? 0);             // G9

      if (!projectNumber) {
        setError("物件番号が入力されていません。Excelの物件番号欄を入力してからアップロードしてください。");
        return;
      }
      if (!projectName) {
        setError("工事名（D4セル）が空です");
        return;
      }

      // Row 21 (0-indexed: 20) month headers → build "YYYY年M月" labels
      const headerRow = rows[20] ?? [];
      const colMonth: Record<number, string> = {};
      let yr = year;
      let prevMo = 0;
      for (let col = 6; col <= 14; col++) {
        const raw = String(headerRow[col] ?? "").trim();
        const m = raw.match(/(\d{1,2})月?/);
        if (!m) continue;
        const mo = Number(m[1]);
        if (col === 6) { yr = year; }
        else if (mo <= prevMo) { yr++; }
        prevMo = mo;
        colMonth[col] = `${yr}年${mo}月`;
      }

      if (Object.keys(colMonth).length === 0) {
        setError("月ヘッダー（行21）が読み取れませんでした");
        return;
      }

      // Detail rows 22–51 (0-indexed 21–50)
      const costs: CostEntry[] = [];
      for (let i = 21; i <= 50; i++) {
        const row = rows[i];
        if (!row) continue;
        const vendorName = String(row[0] ?? "").trim();
        const itemName = String(row[3] ?? "").trim();
        if (!vendorName && !itemName) continue;
        if (vendorName.includes("合計") || itemName.includes("合計")) continue;

        for (const [colStr, paymentMonth] of Object.entries(colMonth)) {
          const amt = Number(row[Number(colStr)] ?? 0);
          if (amt > 0) costs.push({ vendorName, itemName, amount: amt, paymentMonth });
        }
      }

      if (costs.length === 0) {
        setError("有効な明細データが見つかりませんでした");
        return;
      }

      // Check existing by project_number
      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("project_number", projectNumber)
        .maybeSingle();

      setParsed({
        projectNumber, projectName, customerName, salesAmount, costs,
        existingProjectId: existing?.id ?? null,
      });
    } catch {
      setError("ファイルの解析に失敗しました");
    }
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    setError("");

    let projectId: string;

    if (parsed.existingProjectId) {
      projectId = parsed.existingProjectId;
      const { error: delErr } = await supabase.from("project_costs").delete().eq("project_id", projectId);
      if (delErr) { setError("既存原価の削除に失敗: " + delErr.message); setImporting(false); return; }

      const { error: upErr } = await supabase.from("projects").update({
        name: parsed.projectName,
        customer_name: parsed.customerName || null,
        sales_amount: parsed.salesAmount || null,
      }).eq("id", projectId);
      if (upErr) { setError("工事更新に失敗: " + upErr.message); setImporting(false); return; }
    } else {
      const { data: project, error: pErr } = await supabase.from("projects").insert({
        project_number: parsed.projectNumber,
        name: parsed.projectName,
        customer_name: parsed.customerName || null,
        sales_amount: parsed.salesAmount || null,
      }).select("id").single();
      if (pErr || !project) { setError("工事登録に失敗: " + (pErr?.message ?? "")); setImporting(false); return; }
      projectId = project.id;
    }

    const costRows = parsed.costs.map((c) => ({
      project_id: projectId,
      category: "外注費",
      vendor_name: c.vendorName || null,
      item_name: c.itemName || null,
      amount: c.amount,
      payment_month: c.paymentMonth,
    }));

    const { error: cErr } = await supabase.from("project_costs").insert(costRows);
    if (cErr) { setError("原価登録に失敗: " + cErr.message); setImporting(false); return; }

    setImporting(false);
    setDone(true);
  }

  const fmt = (n: number) => `${n.toLocaleString()}円`;
  const isOverwrite = parsed?.existingProjectId != null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Excelインポート</h2>

      {/* Start year/month */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <label className="text-sm font-medium text-foreground">開始年月</label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">Excelの最初の月列に対応する年月を選択してください</p>
        <div className="flex items-center gap-2">
          <select
            value={startYear}
            onChange={(e) => handleStartChange(Number(e.target.value), startMonth)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select
            value={startMonth}
            onChange={(e) => handleStartChange(startYear, Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
          >
            {MONTHS.map((m) => <option key={m} value={m}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* Upload */}
      <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-12 cursor-pointer hover:border-primary/50 transition-colors">
        <Upload className="w-10 h-10 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {fileName || ".xls / .xlsx ファイルをクリックして選択"}
        </span>
        <input type="file" accept=".xls,.xlsx" onChange={handleFileSelect} className="hidden" />
      </label>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 text-sm rounded-2xl bg-card border border-border p-6">
          <Check className="w-5 h-5 text-primary" />
          <span className="text-foreground font-medium">
            {isOverwrite ? "上書き更新" : "新規登録"}完了（{parsed?.projectNumber} {parsed?.projectName}、明細: {parsed?.costs.length}件）
          </span>
        </div>
      )}

      {parsed && !done && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-6 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-bold text-foreground">取り込みプレビュー</h3>
            </div>
            {isOverwrite ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-kpi-amber/10 text-kpi-amber">
                <RefreshCw className="w-3.5 h-3.5" /> 上書き更新
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                <PlusCircle className="w-3.5 h-3.5" /> 新規登録
              </span>
            )}
          </div>

          <div className="border-t border-border">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-6 py-3 text-muted-foreground w-32">物件番号</td>
                  <td className="px-6 py-3 font-semibold text-foreground">{parsed.projectNumber}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-6 py-3 text-muted-foreground">工事名</td>
                  <td className="px-6 py-3 font-semibold text-foreground">{parsed.projectName}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-6 py-3 text-muted-foreground">顧客名</td>
                  <td className="px-6 py-3 text-foreground">{parsed.customerName || "-"}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-6 py-3 text-muted-foreground">契約金額</td>
                  <td className="px-6 py-3 font-semibold text-foreground">{parsed.salesAmount > 0 ? fmt(parsed.salesAmount) : "未入力"}</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-muted-foreground">明細件数</td>
                  <td className="px-6 py-3 text-foreground">{parsed.costs.length}件</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-kpi-surface/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">業者名</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">工種</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">支払月</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">金額</th>
                </tr>
              </thead>
              <tbody>
                {parsed.costs.slice(0, 20).map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-6 py-2.5 text-foreground">{c.vendorName || "-"}</td>
                    <td className="px-6 py-2.5 text-foreground">{c.itemName || "-"}</td>
                    <td className="px-6 py-2.5 text-foreground">{c.paymentMonth}</td>
                    <td className="px-6 py-2.5 text-right text-foreground tabular-nums">{fmt(c.amount)}</td>
                  </tr>
                ))}
                {parsed.costs.length > 20 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-2.5 text-center text-muted-foreground text-xs">
                      他 {parsed.costs.length - 20} 件...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-6 pt-4 border-t border-border">
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {importing ? "登録中..." : "この内容で登録する"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
