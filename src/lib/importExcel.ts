import * as XLSX from "xlsx";

/** 列インデックス → 年月ラベルのマッピング */
const COLUMN_TO_PAYMENT_MONTH: Record<number, string> = {
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

export interface ParsedCost {
  itemName: string;
  vendorName: string;
  amount: number;
  paymentMonth: string;
}

export interface ParsedRow {
  projectName: string;
  customerName: string;
  contractAmount: number;
  fiscalYear: number;
  fiscalMonth: number;
  costs: ParsedCost[];
}

export function parseExcelFile(data: Uint8Array): ParsedRow[] {
  const wb = XLSX.read(data, { type: "array" });
  const parsed: ParsedRow[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const json: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (json.length < 5) continue;

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

    // Costs: rows 10+ have item name (col 0), vendor (col 1)
    // Amount columns 6-14 correspond to payment months
    const costs: ParsedCost[] = [];
    for (let i = 10; i < json.length; i++) {
      const row = json[i];
      if (!row) continue;
      const itemName = String(row[0] ?? "").trim();
      const vendorName = String(row[1] ?? "").trim();
      if (!itemName) continue;

      for (const [colStr, paymentMonth] of Object.entries(COLUMN_TO_PAYMENT_MONTH)) {
        const col = Number(colStr);
        const amount = Number(row[col] ?? 0);
        if (amount > 0) {
          costs.push({ itemName, vendorName, amount, paymentMonth });
        }
      }
    }

    parsed.push({ projectName, customerName, contractAmount, fiscalYear, fiscalMonth, costs });
  }

  return parsed;
}
