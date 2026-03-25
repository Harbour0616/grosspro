"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

type Staff = { id: string; name: string };

type CostRow = {
  vendor_name: string;
  item_name: string;
  monthly: { year: number; month: number; amount: number }[];
  total: number;
};

type ParsedData = {
  projectName: string;
  customerName: string;
  contractAmount: number;
  costs: CostRow[];
};

function parseExcel(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(
          ws,
          { header: 1, defval: null }
        );

        const projectName = String(rows[3]?.[3] ?? "").trim();
        const customerName = String(rows[4]?.[3] ?? "").trim();
        const contractAmount = Number(rows[8]?.[6]) || 0;

        // ファイル名から令和年を推定 (例: "R7_工事名.xlsx" → 2025)
        const reiwaMatch = file.name.match(/R(\d{1,2})/i);
        const westernMatch = file.name.match(/(20\d{2})/);
        let fileYear: number;
        if (reiwaMatch) {
          fileYear = 2018 + Number(reiwaMatch[1]); // R1=2019, R6=2024, R7=2025
        } else if (westernMatch) {
          fileYear = Number(westernMatch[1]);
        } else {
          fileYear = new Date().getFullYear();
        }

        // 行21（index20）のヘッダーから月名を取得
        const headerRow = rows[20] ?? [];
        const monthColumns: { col: number; year: number; month: number }[] = [];
        for (let col = 6; col <= 14; col++) {
          const cell = String(headerRow[col] ?? "").trim();
          const m = cell.match(/(\d{1,2})月/);
          if (m) {
            const month = Number(m[1]);
            // 会計年度5月始まり: 5〜12月→前年、1〜4月→当年
            const year = month >= 5 ? fileYear - 1 : fileYear;
            monthColumns.push({ col, year, month });
          }
        }

        // 行22〜50（index21〜49）の原価明細
        const costs: CostRow[] = [];
        for (let r = 21; r <= 49; r++) {
          const row = rows[r];
          if (!row) continue;

          const totalAmount = Number(row[16]);
          if (!totalAmount || isNaN(totalAmount)) continue;

          const vendor_name = String(row[0] ?? "").trim();
          const item_name = String(row[3] ?? "").trim();

          const monthly: CostRow["monthly"] = [];
          for (const mc of monthColumns) {
            const amt = Number(row[mc.col]) || 0;
            if (amt !== 0) {
              monthly.push({ year: mc.year, month: mc.month, amount: amt });
            }
          }

          costs.push({ vendor_name, item_name, monthly, total: totalAmount });
        }

        resolve({ projectName, customerName, contractAmount, costs });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("ファイル読み込みに失敗しました"));
    reader.readAsArrayBuffer(file);
  });
}

export default function ImportPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [staffId, setStaffId] = useState("");
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("staff")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setStaffList(data);
      });
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    setDone(false);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const data = await parseExcel(file);
      setParsed(data);
    } catch {
      setError("Excelファイルの解析に失敗しました。フォーマットを確認してください。");
      setParsed(null);
    }
  }, []);

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    setError("");

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .insert({
        name: parsed.projectName,
        customer_name: parsed.customerName,
        staff_id: staffId || null,
        contract_amount: parsed.contractAmount,
      })
      .select("id")
      .single();

    if (projErr || !project) {
      setError("工事の登録に失敗しました: " + (projErr?.message ?? ""));
      setImporting(false);
      return;
    }

    const costRows = parsed.costs.flatMap((c) =>
      c.monthly.map((m) => ({
        project_id: project.id,
        category: "外注費",
        amount: m.amount,
        memo: `${m.year}年${String(m.month).padStart(2, "0")}月`,
        item_name: c.item_name,
        vendor_name: c.vendor_name,
      }))
    );

    if (costRows.length > 0) {
      const { error: costErr } = await supabase
        .from("project_costs")
        .insert(costRows);
      if (costErr) {
        setError("原価の登録に失敗しました: " + costErr.message);
        setImporting(false);
        return;
      }
    }

    setImporting(false);
    setDone(true);
  }

  const fmt = (n: number) =>
    n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">Excelインポート</h1>

      {/* ファイルアップロード */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">ファイル選択</h2>
        </div>
        <div className="p-6">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Excelファイル（.xls / .xlsx）
            </span>
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFile}
              className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </label>
          {fileName && (
            <p className="mt-2 text-sm text-gray-500">選択中: {fileName}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">
          {error}
        </div>
      )}

      {done && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-6 text-sm">
          インポートが完了しました。
        </div>
      )}

      {/* プレビュー */}
      {parsed && !done && (
        <>
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">プレビュー</h2>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-500">工事名</div>
                  <div className="font-medium">
                    {parsed.projectName || "(空欄)"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">顧客名</div>
                  <div className="font-medium">
                    {parsed.customerName || "(空欄)"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">契約金額</div>
                  <div className="font-medium">
                    {fmt(parsed.contractAmount)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  担当者
                </label>
                <select
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="w-full max-w-xs border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- 選択してください --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 明細テーブル */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                原価明細（{parsed.costs.length}件）
              </h2>
            </div>
            {parsed.costs.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                取り込み対象の明細がありません。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        業者名
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        工種名
                      </th>
                      {parsed.costs[0]?.monthly.map((m, i) => (
                        <th
                          key={i}
                          className="px-4 py-3 font-medium text-right whitespace-nowrap"
                        >
                          {m.year}年{m.month}月
                        </th>
                      ))}
                      <th className="px-4 py-3 font-medium text-right whitespace-nowrap">
                        合計
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.costs.map((c, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {c.vendor_name || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {c.item_name || "-"}
                        </td>
                        {c.monthly.map((m, j) => (
                          <td key={j} className="px-4 py-3 text-right">
                            {m.amount ? fmt(m.amount) : "-"}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right font-semibold">
                          {fmt(c.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 取り込みボタン */}
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {importing ? "取り込み中..." : "取り込む"}
            </button>
            <button
              onClick={() => {
                setParsed(null);
                setFileName("");
              }}
              className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </>
      )}
    </>
  );
}
