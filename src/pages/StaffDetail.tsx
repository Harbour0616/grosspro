import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

interface ProjectRow {
  id: string;
  name: string;
  sales_amount: number;
  totalCost: number;
  grossProfit: number;
  profitRate: number;
}

interface StaffDetailProps {
  staffId: string;
  staffName: string;
  onBack: () => void;
}

export default function StaffDetail({ staffId, staffName, onBack }: StaffDetailProps) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);

  useEffect(() => {
    async function load() {
      const [{ data: pj }, { data: costs }] = await Promise.all([
        supabase.from("projects").select("id, name, sales_amount").eq("staff_id", staffId),
        supabase.from("project_costs").select("project_id, amount"),
      ]);
      if (!pj) return;

      const rows: ProjectRow[] = pj.map((p) => {
        const totalCost = (costs ?? [])
          .filter((c) => c.project_id === p.id)
          .reduce((sum, c) => sum + (c.amount ?? 0), 0);
        const sales = p.sales_amount ?? 0;
        const grossProfit = sales - totalCost;
        const profitRate = sales > 0 ? (grossProfit / sales) * 100 : 0;
        return { id: p.id, name: p.name, sales_amount: sales, totalCost, grossProfit, profitRate };
      });
      setProjects(rows);
    }
    load();
  }, [staffId]);

  const formatYen = (n: number) =>
    n >= 100000000
      ? `¥${(n / 100000000).toFixed(2)}億`
      : `¥${(n / 10000).toFixed(0)}万`;

  const totalSales = projects.reduce((s, p) => s + p.sales_amount, 0);
  const totalCost = projects.reduce((s, p) => s + p.totalCost, 0);
  const totalProfit = totalSales - totalCost;
  const totalRate = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          戻る
        </button>
        <h2 className="text-xl font-bold text-foreground">{staffName} の担当工事</h2>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-kpi-surface/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">工事名</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">売上金額</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">原価合計</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">粗利</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">粗利率</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-kpi-surface/30 transition-colors">
                  <td className="px-6 py-4 font-semibold text-foreground">{p.name}</td>
                  <td className="px-6 py-4 text-right text-sm text-foreground">{formatYen(p.sales_amount)}</td>
                  <td className="px-6 py-4 text-right text-sm text-foreground">{formatYen(p.totalCost)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{formatYen(p.grossProfit)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      p.profitRate >= 25 ? "bg-primary/10 text-primary" : "bg-kpi-amber/10 text-kpi-amber"
                    )}>
                      {p.profitRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    担当工事がありません
                  </td>
                </tr>
              )}
            </tbody>
            {projects.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-kpi-surface/50 font-semibold">
                  <td className="px-6 py-4 text-foreground">合計</td>
                  <td className="px-6 py-4 text-right text-foreground">{formatYen(totalSales)}</td>
                  <td className="px-6 py-4 text-right text-foreground">{formatYen(totalCost)}</td>
                  <td className="px-6 py-4 text-right text-foreground">{formatYen(totalProfit)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      totalRate >= 25 ? "bg-primary/10 text-primary" : "bg-kpi-amber/10 text-kpi-amber"
                    )}>
                      {totalRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
