import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, FileSpreadsheet, Check, AlertCircle, RefreshCw, PlusCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface ParsedData {
  projectNumber: string;
  projectName: string;
  customerName: string;
  contractAmount: number;
  costAmount: number;
  existingProjectId: string | null;
}

const fmt = (n: number) => n.toLocaleString();

export default function ExcelImport() {
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  function processFile(file: File) {
    setFileName(file.name);
    setParsed(null);
    setDone(false);
    setError("");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const buf = new Uint8Array(ev.target?.result as ArrayBuffer);
      await parseFile(buf);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.xlsx?$/i.test(file.name)) processFile(file);
  }

  async function parseFile(buf: Uint8Array) {
    try {
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { setError("シートが見つかりません"); return; }

      const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const projectNumber = String(rows[1]?.[12] ?? "").trim(); // M2
      const projectName = String(rows[3]?.[3] ?? "").trim();     // D4
      const customerName = String(rows[4]?.[3] ?? "").trim();    // D5
      const contractAmount = Number(rows[8]?.[6] ?? 0);          // G9
      const costAmount = Number(rows[14]?.[6] ?? 0);             // G15

      if (!projectNumber) {
        setError("物件番号が入力されていません。Excelの物件番号欄を入力してからアップロードしてください。");
        return;
      }
      if (!projectName) {
        setError("工事名（D4セル）が空です");
        return;
      }

      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("project_number", projectNumber)
        .maybeSingle();

      setParsed({
        projectNumber, projectName, customerName, contractAmount, costAmount,
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

    const row = {
      project_number: parsed.projectNumber,
      name: parsed.projectName,
      customer_name: parsed.customerName || null,
      contract_amount: parsed.contractAmount || 0,
      cost_amount: parsed.costAmount || 0,
    };

    if (parsed.existingProjectId) {
      const { error: err } = await supabase.from("projects").update(row).eq("id", parsed.existingProjectId);
      if (err) { setError("工事更新に失敗: " + err.message); setImporting(false); return; }
    } else {
      const { error: err } = await supabase.from("projects").insert(row);
      if (err) { setError("工事登録に失敗: " + err.message); setImporting(false); return; }
    }

    setImporting(false);
    setDone(true);
  }

  const isOverwrite = parsed?.existingProjectId != null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Excelインポート</h2>

      {/* Upload / Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card p-16 cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
      >
        <Upload className={`w-12 h-12 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-sm text-muted-foreground text-center">
          {fileName || "ファイルをドラッグ&ドロップ、またはクリックして選択"}
        </span>
        <span className="text-xs text-muted-foreground">.xls / .xlsx</span>
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
            {isOverwrite ? "上書き更新" : "新規登録"}完了（{parsed?.projectNumber} {parsed?.projectName}）
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
                  <td className="px-6 py-3 font-semibold text-foreground tabular-nums">{parsed.contractAmount > 0 ? fmt(parsed.contractAmount) : "-"}</td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-muted-foreground">現場経費合計</td>
                  <td className="px-6 py-3 font-semibold text-foreground tabular-nums">{parsed.costAmount > 0 ? fmt(parsed.costAmount) : "-"}</td>
                </tr>
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
