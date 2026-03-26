import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface RankingEntry {
  rank: number;
  name: string;
  grossProfit: number;
  profitRate: number;
  projects: number;
}

const formatYen = (n: number) => `¥${(n / 10000).toFixed(0)}万`;

const rankColors: Record<number, string> = {
  1: "text-rank-gold",
  2: "text-rank-silver",
  3: "text-rank-bronze",
};

export default function RankingTable() {
  const [data, setData] = useState<RankingEntry[]>([]);

  useEffect(() => {
    async function load() {
      const { data: staff } = await supabase.from("staff").select("id, name");
      const { data: projects } = await supabase.from("projects").select("id, staff_id, contract_amount");
      const { data: costs } = await supabase.from("project_costs").select("project_id, amount");
      if (!staff || !projects || !costs) return;

      const entries = staff.map((s) => {
        const myProjects = projects.filter((p) => p.staff_id === s.id);
        const totalSales = myProjects.reduce((sum, p) => sum + (p.contract_amount ?? 0), 0);
        const totalCost = myProjects.reduce((sum, p) => {
          return sum + costs.filter((c) => c.project_id === p.id).reduce((a, b) => a + (b.amount ?? 0), 0);
        }, 0);
        const grossProfit = totalSales - totalCost;
        const profitRate = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
        return { name: s.name, grossProfit, profitRate, projects: myProjects.length };
      });

      setData(entries.sort((a, b) => b.grossProfit - a.grossProfit).map((e, i) => ({ ...e, rank: i + 1 })));
    }
    load();
  }, []);

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="p-6 pb-4 flex items-center gap-3">
        <Trophy className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-bold text-foreground">担当者別 粗利ランキング</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-t border-border bg-kpi-surface/50">
              <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3 w-16">順位</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">担当者</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">粗利額</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">粗利率</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">案件数</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.rank} className="border-t border-border hover:bg-kpi-surface/30 transition-colors">
                <td className="px-6 py-4">
                  <span className={cn("text-lg font-bold", rankColors[entry.rank] || "text-muted-foreground")}>
                    {entry.rank}
                  </span>
                </td>
                <td className="px-6 py-4 font-semibold text-foreground">{entry.name}</td>
                <td className="px-6 py-4 text-right font-semibold text-foreground">{formatYen(entry.grossProfit)}</td>
                <td className="px-6 py-4 text-right">
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                    entry.profitRate >= 25 ? "bg-primary/10 text-primary" : "bg-kpi-amber/10 text-kpi-amber"
                  )}>
                    {entry.profitRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm text-muted-foreground">{entry.projects}件</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
