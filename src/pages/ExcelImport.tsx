import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface ParsedRow {
  projectName: string;
  customerName: string;
  contractAmount: number;
  fiscalYear: number;
  fiscalMonth: number;
  costs: { itemName: string; vendorName: string; amount: number }[];
}

export default function ExcelImport() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number } | null>(null);
  const [error, setError] = useState("");

  function parseExcel(file: File) {
    setError("");
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const parsed: ParsedRow[] = [];

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const json: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          if (json.length < 5) continue;

          // Row indexes (0-based): row 3 = project name, row 4 = customer, row 8 col 6 = contract amount
          const projectName = String(json[3]?.[0] ?? "").trim();
          if (!projectName) continue;
          const customerName = String(json[4]?.[0] ?? "").trim();
          const contractAmount = Number(json[8]?.[6] ?? 0);

          // Reiwa year from sheet name: e.g. "R7" → 2025
          const reiwaMatch = sheetName.match(/R(\d+)/i);
          let baseYear = new Date().getFullYear();
          if (reiwaMatch) {
            baseYear = 2018 + Number(reiwaMatch[1]);
          }

          // Parse month from sheet name
          const monthMatch = sheetName.match(/(\d{1,2})月/);
          let fiscalMonth = 1;
          if (monthMatch) {
            fiscalMonth = Number(monthMatch[1]);
          }

          // Fiscal year (5月始まり): 5-12月 → baseYear-1, 1-4月 → baseYear
          const fiscalYear = fiscalMonth >= 5 ? baseYear - 1 : baseYear;

          // Costs: rows 10+ typically have item name (col 0), vendor (col 1), amount (col 5)
          const costs: { itemName: string; vendorName: string; amount: number }[] = [];
          for (let i = 10; i < json.length; i++) {
            const row = json[i];
            if (!row) continue;
            const itemName = String(row[0] ?? "").trim();
            const vendorName = String(row[1] ?? "").trim();
            const amount = Number(row[5] ?? 0);
            if (itemName && amount > 0) {
              costs.push({ itemName, vendorName, amount });
            }
          }

          parsed.push({ projectName, customerName, contractAmount, fiscalYear, fiscalMonth, costs });
        }

        if (parsed.length === 0) {
          setError("有効なデータが見つかりませんでした");
          return;
        }
        setRows(parsed);
      } catch {
        setError("ファイルの解析に失敗しました");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRows([]);
    parseExcel(file);
  }

  async function handleImport() {
    setImporting(true);
    setResult(null);
    let ok = 0;
    let fail = 0;

    for (const row of rows) {
      const { data: project, error: pErr } = await supabase
        .from("projects")
        .insert({
          name: row.projectName,
          customer_name: row.customerName || null,
          contract_amount: row.contractAmount || null,
        })
        .select("id")
        .single();

      if (pErr || !project) { fail++; continue; }

      for (const cost of row.costs) {
        const { error: cErr } = await supabase.from("project_costs").insert({
          project_id: project.id,
          item_name: cost.itemName,
          vendor_name: cost.vendorName,
          amount: cost.amount,
        });
        if (cErr) fail++;
      }
      ok++;
    }

    setResult({ ok, fail });
    setImporting(false);
  }

  const formatYen = (n: number) => `${n.toLocaleString()}円`;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Excelインポート</h2>

      {/* Upload area */}
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

      {result && (
        <div className="flex items-center gap-2 text-sm">
          <Check className="w-4 h-4 text-primary" />
          <span className="text-foreground">
            インポート完了: 成功 {result.ok}件 / 失敗 {result.fail}件
          </span>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-6 pb-4 flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-bold text-foreground">プレビュー（{rows.length}件）</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-t border-border bg-kpi-surface/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">工事名</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">顧客名</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">請負金額</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">年度</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">月</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">原価項目数</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border hover:bg-kpi-surface/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{r.projectName}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{r.customerName || "-"}</td>
                    <td className="px-6 py-4 text-right text-sm text-foreground">{formatYen(r.contractAmount)}</td>
                    <td className="px-6 py-4 text-right text-sm text-foreground">{r.fiscalYear}年度</td>
                    <td className="px-6 py-4 text-right text-sm text-foreground">{r.fiscalMonth}月</td>
                    <td className="px-6 py-4 text-right text-sm text-muted-foreground">{r.costs.length}件</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 pt-4 border-t border-border">
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {importing ? "インポート中..." : "Supabaseに登録"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
