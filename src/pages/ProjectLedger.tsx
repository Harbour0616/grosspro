import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

interface CostRow {
  id: string;
  vendor_name: string | null;
  item_name: string | null;
  amount: number | null;
  payment_month: string | null;
}

interface ProjectData {
  sales_amount: number | null;
  customer_name: string | null;
  staff_id: string | null;
}

interface ProjectLedgerProps {
  projectId: string;
  projectName: string;
  onBack: () => void;
}

const fmt = (n: number) => n.toLocaleString();

/** 月ラベルのソート順 */
const MONTH_ORDER = [
  "2024年10月", "2024年11月", "2024年12月",
  "2025年1月", "2025年2月", "2025年3月",
  "2025年4月", "2025年5月", "2025年6月",
];

export default function ProjectLedger({ projectId, projectName, onBack }: ProjectLedgerProps) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [staffName, setStaffName] = useState("-");

  useEffect(() => {
    async function load() {
      const { data: pj } = await supabase
        .from("projects")
        .select("sales_amount, customer_name, staff_id")
        .eq("id", projectId)
        .single();
      if (!pj) return;
      setProject(pj);

      if (pj.staff_id) {
        const { data: st } = await supabase.from("staff").select("name").eq("id", pj.staff_id).single();
        if (st) setStaffName(st.name);
      }

      const { data: c } = await supabase
        .from("project_costs")
        .select("id, vendor_name, item_name, amount, payment_month")
        .eq("project_id", projectId)
        .order("id");
      if (c) setCosts(c);
    }
    load();
  }, [projectId]);

  // --- Pivot data ---
  const { months, pivotRows, monthTotals, grandTotal } = useMemo(() => {
    // Collect unique months that exist in data, sorted by MONTH_ORDER
    const monthSet = new Set<string>();
    costs.forEach((c) => { if (c.payment_month) monthSet.add(c.payment_month); });
    const months = MONTH_ORDER.filter((m) => monthSet.has(m));

    // Group by "vendor_name|item_name"
    const map = new Map<string, { vendor: string; item: string; byMonth: Record<string, number>; total: number }>();
    for (const c of costs) {
      const key = `${c.vendor_name ?? ""}|${c.item_name ?? ""}`;
      if (!map.has(key)) {
        map.set(key, { vendor: c.vendor_name ?? "-", item: c.item_name ?? "-", byMonth: {}, total: 0 });
      }
      const entry = map.get(key)!;
      const month = c.payment_month ?? "";
      const amt = c.amount ?? 0;
      entry.byMonth[month] = (entry.byMonth[month] ?? 0) + amt;
      entry.total += amt;
    }
    const pivotRows = Array.from(map.values());

    // Month column totals
    const monthTotals: Record<string, number> = {};
    let grandTotal = 0;
    for (const row of pivotRows) {
      for (const m of months) {
        monthTotals[m] = (monthTotals[m] ?? 0) + (row.byMonth[m] ?? 0);
      }
      grandTotal += row.total;
    }

    return { months, pivotRows, monthTotals, grandTotal };
  }, [costs]);

  const salesAmount = project?.sales_amount ?? 0;
  const totalCost = grandTotal;
  const grossProfit = salesAmount - totalCost;
  const grossRate = salesAmount > 0 ? (grossProfit / salesAmount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        戻る
      </button>

      {/* Header card */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <h2 className="text-xl font-bold text-foreground">{projectName}</h2>
        <div className="flex gap-6 mt-2">
          <span className="text-sm text-muted-foreground">顧客: <span className="text-foreground font-medium">{project?.customer_name ?? "-"}</span></span>
          <span className="text-sm text-muted-foreground">担当: <span className="text-foreground font-medium">{staffName}</span></span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-card border border-border p-5">
          <span className="text-xs text-muted-foreground">契約金額</span>
          <p className="text-lg font-bold text-foreground mt-1">
            {salesAmount > 0 ? fmt(salesAmount) : "未入力"}
          </p>
        </div>
        <div className="rounded-xl bg-card border border-border p-5">
          <span className="text-xs text-muted-foreground">現場経費合計</span>
          <p className="text-lg font-bold text-foreground mt-1">{fmt(totalCost)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-5">
          <span className="text-xs text-muted-foreground">粗利金額</span>
          <p className={cn("text-lg font-bold mt-1", grossProfit < 0 ? "text-destructive" : "text-foreground")}>
            {fmt(grossProfit)}
          </p>
        </div>
        <div className="rounded-xl bg-card border border-border p-5">
          <span className="text-xs text-muted-foreground">粗利率</span>
          <p className={cn("text-lg font-bold mt-1", grossRate < 0 ? "text-destructive" : "text-foreground")}>
            {salesAmount > 0 ? `${grossRate.toFixed(1)}%` : "-"}
          </p>
        </div>
      </div>

      {/* Cost pivot table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="p-6 pb-4">
          <h3 className="text-base font-bold text-foreground">原価明細</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-border bg-kpi-surface">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap sticky left-0 bg-kpi-surface z-10">業者名</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">工種</th>
                {months.map((m) => (
                  <th key={m} className="text-right text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap min-w-[100px]">{m}</th>
                ))}
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap font-bold min-w-[110px]">合計</th>
              </tr>
            </thead>
            <tbody>
              {pivotRows.map((row, i) => (
                <tr key={i} className="border-t border-border hover:bg-kpi-surface/30 transition-colors">
                  <td className="px-4 py-3 text-foreground whitespace-nowrap sticky left-0 bg-card z-10">{row.vendor}</td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">{row.item}</td>
                  {months.map((m) => (
                    <td key={m} className="px-4 py-3 text-right text-foreground tabular-nums">
                      {row.byMonth[m] ? fmt(row.byMonth[m]) : ""}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold text-foreground tabular-nums">{fmt(row.total)}</td>
                </tr>
              ))}
              {pivotRows.length === 0 && (
                <tr>
                  <td colSpan={months.length + 3} className="px-4 py-12 text-center text-muted-foreground">
                    原価データがありません
                  </td>
                </tr>
              )}
              {pivotRows.length > 0 && (
                <tr className="border-t-2 border-border bg-kpi-surface font-bold">
                  <td className="px-4 py-3 text-foreground sticky left-0 bg-kpi-surface z-10" colSpan={2}>合計</td>
                  {months.map((m) => (
                    <td key={m} className="px-4 py-3 text-right text-foreground tabular-nums">
                      {monthTotals[m] ? fmt(monthTotals[m]) : ""}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right text-foreground tabular-nums">{fmt(grandTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
