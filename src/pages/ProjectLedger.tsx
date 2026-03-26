import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ArrowLeft, Pencil, Save, X } from "lucide-react";

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

interface PivotRow {
  vendor: string;
  item: string;
  byMonth: Record<string, number>;
  byMonthIds: Record<string, string[]>;
  total: number;
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

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
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
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Pivot data ---
  const { months, pivotRows, monthTotals, grandTotal } = useMemo(() => {
    const monthSet = new Set<string>();
    costs.forEach((c) => { if (c.payment_month) monthSet.add(c.payment_month); });
    const months = MONTH_ORDER.filter((m) => monthSet.has(m));

    const map = new Map<string, PivotRow>();
    for (const c of costs) {
      const key = `${c.vendor_name ?? ""}|${c.item_name ?? ""}`;
      if (!map.has(key)) {
        map.set(key, { vendor: c.vendor_name ?? "-", item: c.item_name ?? "-", byMonth: {}, byMonthIds: {}, total: 0 });
      }
      const entry = map.get(key)!;
      const month = c.payment_month ?? "";
      const amt = c.amount ?? 0;
      entry.byMonth[month] = (entry.byMonth[month] ?? 0) + amt;
      if (!entry.byMonthIds[month]) entry.byMonthIds[month] = [];
      entry.byMonthIds[month].push(c.id);
      entry.total += amt;
    }
    const pivotRows = Array.from(map.values());

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

  // --- Edit helpers ---
  function startEdit() {
    const vals: Record<string, Record<string, string>> = {};
    for (const row of pivotRows) {
      const key = `${row.vendor}|${row.item}`;
      vals[key] = {};
      for (const m of months) {
        const v = row.byMonth[m] ?? 0;
        vals[key][m] = v > 0 ? String(v) : "";
      }
    }
    setEditValues(vals);
    setEditing(true);
  }

  function cancelEdit() {
    setEditValues({});
    setEditing(false);
  }

  function getEditKey(row: PivotRow) {
    return `${row.vendor}|${row.item}`;
  }

  function getCellValue(row: PivotRow, month: string): string {
    const key = getEditKey(row);
    return editValues[key]?.[month] ?? "";
  }

  function setCellValue(row: PivotRow, month: string, value: string) {
    const key = getEditKey(row);
    setEditValues((prev) => ({
      ...prev,
      [key]: { ...prev[key], [month]: value },
    }));
  }

  function isCellChanged(row: PivotRow, month: string): boolean {
    const original = row.byMonth[month] ?? 0;
    const edited = Number(getCellValue(row, month)) || 0;
    return original !== edited;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const inserts: { project_id: string; category: string; vendor_name: string | null; item_name: string | null; amount: number; payment_month: string }[] = [];
      const updates: { id: string; amount: number }[] = [];
      const deleteIds: string[] = [];

      for (const row of pivotRows) {
        for (const m of months) {
          if (!isCellChanged(row, m)) continue;

          const ids = row.byMonthIds[m] ?? [];
          const newVal = Number(getCellValue(row, m)) || 0;

          if (newVal > 0 && ids.length > 0) {
            updates.push({ id: ids[0], amount: newVal });
            if (ids.length > 1) deleteIds.push(...ids.slice(1));
          } else if (newVal > 0 && ids.length === 0) {
            inserts.push({
              project_id: projectId,
              category: "外注費",
              vendor_name: row.vendor === "-" ? null : row.vendor,
              item_name: row.item === "-" ? null : row.item,
              amount: newVal,
              payment_month: m,
            });
          } else if (newVal === 0 && ids.length > 0) {
            deleteIds.push(...ids);
          }
        }
      }

      // Execute all operations
      for (const u of updates) {
        await supabase.from("project_costs").update({ amount: u.amount }).eq("id", u.id);
      }
      if (deleteIds.length > 0) {
        await supabase.from("project_costs").delete().in("id", deleteIds);
      }
      if (inserts.length > 0) {
        await supabase.from("project_costs").insert(inserts);
      }

      setEditing(false);
      setEditValues({});
      await loadData();
    } finally {
      setSaving(false);
    }
  }

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
        <div className="p-6 pb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">原価明細</h3>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "保存中..." : "保存"}
                </button>
              </>
            ) : (
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Pencil className="w-4 h-4" />
                編集
              </button>
            )}
          </div>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-border bg-kpi-surface">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap sticky top-0 left-0 bg-kpi-surface z-30 min-w-[120px]">業者名</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap sticky top-0 left-[120px] bg-kpi-surface z-30 min-w-[120px]">工種</th>
                {months.map((m) => (
                  <th key={m} className="text-right text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap sticky top-0 bg-kpi-surface z-10 min-w-[100px]">{m}</th>
                ))}
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap font-bold sticky top-0 bg-kpi-surface z-10 min-w-[110px]">合計</th>
              </tr>
            </thead>
            <tbody>
              {pivotRows.map((row, i) => {
                const key = getEditKey(row);
                // Compute row total from edit values when editing
                const rowTotal = editing
                  ? months.reduce((sum, m) => sum + (Number(editValues[key]?.[m]) || 0), 0)
                  : row.total;

                return (
                  <tr key={i} className="border-t border-border hover:bg-kpi-surface/30 transition-colors">
                    <td className="px-4 py-3 text-foreground whitespace-nowrap sticky left-0 bg-card z-10 min-w-[120px]">{row.vendor}</td>
                    <td className="px-4 py-3 text-foreground whitespace-nowrap sticky left-[120px] bg-card z-10 min-w-[120px]">{row.item}</td>
                    {months.map((m) => (
                      <td key={m} className={cn(
                        "px-4 py-1 text-right tabular-nums",
                        editing && isCellChanged(row, m) && "bg-primary/10"
                      )}>
                        {editing ? (
                          <input
                            type="number"
                            value={getCellValue(row, m)}
                            onChange={(e) => setCellValue(row, m, e.target.value)}
                            className="w-full bg-transparent text-right text-foreground text-sm outline-none border-b border-border focus:border-primary py-2 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          <span className="py-2 inline-block text-foreground">
                            {row.byMonth[m] ? fmt(row.byMonth[m]) : ""}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-bold text-foreground tabular-nums">{fmt(rowTotal)}</td>
                  </tr>
                );
              })}
              {pivotRows.length === 0 && (
                <tr>
                  <td colSpan={months.length + 3} className="px-4 py-12 text-center text-muted-foreground">
                    原価データがありません
                  </td>
                </tr>
              )}
              {pivotRows.length > 0 && (
                <tr className="border-t-2 border-border bg-kpi-surface font-bold">
                  <td className="px-4 py-3 text-foreground sticky left-0 bg-kpi-surface z-10 min-w-[120px]">合計</td>
                  <td className="px-4 py-3 sticky left-[120px] bg-kpi-surface z-10 min-w-[120px]"></td>
                  {months.map((m) => {
                    const colTotal = editing
                      ? pivotRows.reduce((sum, row) => sum + (Number(editValues[getEditKey(row)]?.[m]) || 0), 0)
                      : (monthTotals[m] ?? 0);
                    return (
                      <td key={m} className="px-4 py-3 text-right text-foreground tabular-nums">
                        {colTotal ? fmt(colTotal) : ""}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right text-foreground tabular-nums">
                    {fmt(editing
                      ? pivotRows.reduce((sum, row) => sum + months.reduce((s, m) => s + (Number(editValues[getEditKey(row)]?.[m]) || 0), 0), 0)
                      : grandTotal
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
