import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, FileSpreadsheet, Check, AlertCircle, RefreshCw, PlusCircle } from "lucide-react";
import * as XLSX from "xlsx";

const COL_MONTH: Record<number, string> = {
  6: "2024年10月",
  7: "2024年11月",
  8: "2024年12月",
  9: "2025年1月",
  10: "2025年2月",
  11: "2025年3月",
  12: "2025年4月",
  13: "2025年5月",
  14: "2025年6月",
};

interface CostEntry {
  vendorName: string;
  itemName: string;
  amount: number;
  paymentMonth: string;
}

interface ParsedData {
  projectName: string;
  customerName: string;
  salesAmount: number;
  costs: CostEntry[];
  existingProjectId: string | null;
}

export default function ExcelImport() {
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setError("");
    setDone(false);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) { setError("シートが見つかりません"); return; }

        const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const projectName = String(rows[3]?.[3] ?? "").trim();   // D4
        const customerName = String(rows[4]?.[3] ?? "").trim();  // D5
        const salesAmount = Number(rows[8]?.[6] ?? 0);           // G9

        if (!projectName) {
          setError("工事名（D4セル）が空です");
          return;
        }

        // Detail rows: 22–51 (0-indexed: 21–50)
        const costs: CostEntry[] = [];
        for (let i = 21; i <= 50; i++) {
          const row = rows[i];
          if (!row) continue;

          const vendorName = String(row[0] ?? "").trim();
          const itemName = String(row[3] ?? "").trim();

          if (!vendorName && !itemName) continue;
          if (vendorName.includes("合計") || itemName.includes("合計")) continue;

          for (const [colStr, paymentMonth] of Object.entries(COL_MONTH)) {
            const col = Number(colStr);
            const amount = Number(row[col] ?? 0);
            if (amount > 0) {
              costs.push({ vendorName, itemName, amount, paymentMonth });
            }
          }
        }

        if (costs.length === 0) {
          setError("有効な明細データが見つかりませんでした");
          return;
        }

        // Check existing project
        const { data: existing } = await supabase
          .from("projects")
          .select("id")
          .eq("name", projectName)
          .maybeSingle();

        setParsed({
          projectName,
          customerName,
          salesAmount,
          costs,
          existingProjectId: existing?.id ?? null,
        });
      } catch {
        setError("ファイルの解析に失敗しました");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    setError("");

    let projectId: string;

    if (parsed.existingProjectId) {
      // --- Overwrite existing ---
      projectId = parsed.existingProjectId;

      // Delete old costs
      const { error: delErr } = await supabase
        .from("project_costs")
        .delete()
        .eq("project_id", projectId);
      if (delErr) {
        setError("既存原価の削除に失敗しました: " + delErr.message);
        setImporting(false);
        return;
      }

      // Update project
      const { error: upErr } = await supabase
        .from("projects")
        .update({
          customer_name: parsed.customerName || null,
          sales_amount: parsed.salesAmount || null,
        })
        .eq("id", projectId);
      if (upErr) {
        setError("工事の更新に失敗しました: " + upErr.message);
        setImporting(false);
        return;
      }
    } else {
      // --- Insert new ---
      const { data: project, error: pErr } = await supabase
        .from("projects")
        .insert({
          name: parsed.projectName,
          customer_name: parsed.customerName || null,
          sales_amount: parsed.salesAmount || null,
        })
        .select("id")
        .single();

      if (pErr || !project) {
        setError("工事登録に失敗しました: " + (pErr?.message ?? ""));
        setImporting(false);
        return;
      }
      projectId = project.id;
    }

    // Insert costs
    const costRows = parsed.costs.map((c) => ({
      project_id: projectId,
      category: "外注費",
      vendor_name: c.vendorName || null,
      item_name: c.itemName || null,
      amount: c.amount,
      payment_month: c.paymentMonth,
    }));

    const { error: cErr } = await supabase.from("project_costs").insert(costRows);
    if (cErr) {
      setError("原価データ登録に失敗しました: " + cErr.message);
      setImporting(false);
      return;
    }

    setImporting(false);
    setDone(true);
  }

  const fmt = (n: number) => `${n.toLocaleString()}円`;
  const isOverwrite = parsed?.existingProjectId != null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Excelインポート</h2>

      {/* Upload */}
      <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-12 cursor-pointer hover:border-primary/50 transition-colors">
        <Upload className="w-10 h-10 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {fileName || ".xls / .xlsx ファイルをクリックして選択"}
        </span>
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 text-sm rounded-2xl bg-card border border-border p-6">
          <Check className="w-5 h-5 text-primary" />
          <span className="text-foreground font-medium">
            {isOverwrite ? "上書き更新" : "新規登録"}完了しました（工事: {parsed?.projectName}、明細: {parsed?.costs.length}件）
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
                <RefreshCw className="w-3.5 h-3.5" />
                上書き更新
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                <PlusCircle className="w-3.5 h-3.5" />
                新規登録
              </span>
            )}
          </div>

          {/* Project info */}
          <div className="border-t border-border">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-6 py-3 text-muted-foreground w-32">工事名</td>
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

          {/* Detail preview */}
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

          {/* Submit */}
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
