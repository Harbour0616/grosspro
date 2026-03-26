"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Percent, Building2, BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import KpiCard from "@/components/KpiCard";
import RankingTable from "@/components/RankingTable";

type Kpi = {
  totalGrossProfit: string;
  avgGrossProfitRate: string;
  projectCount: string;
  avgProjectGrossProfit: string;
};

export default function Page() {
  const [kpi, setKpi] = useState<Kpi | null>(null);

  useEffect(() => {
    fetchKpi();
  }, []);

  async function fetchKpi() {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, contract_amount");
    const { data: costs } = await supabase
      .from("project_costs")
      .select("project_id, amount");

    if (!projects) return;

    const costByProject = new Map<string, number>();
    (costs ?? []).forEach((c) => {
      costByProject.set(
        c.project_id,
        (costByProject.get(c.project_id) ?? 0) + c.amount
      );
    });

    let totalRevenue = 0;
    let totalCost = 0;
    projects.forEach((p) => {
      totalRevenue += p.contract_amount ?? 0;
      totalCost += costByProject.get(p.id) ?? 0;
    });

    const totalGP = totalRevenue - totalCost;
    const avgRate = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : 0;
    const avgGP = projects.length > 0 ? totalGP / projects.length : 0;

    const fmtYen = (n: number) => {
      if (Math.abs(n) >= 1e8) return `¥${(n / 1e8).toFixed(2)}億`;
      if (Math.abs(n) >= 1e4) return `¥${Math.round(n / 1e4)}万`;
      return `¥${n.toLocaleString()}`;
    };

    setKpi({
      totalGrossProfit: fmtYen(totalGP),
      avgGrossProfitRate: `${avgRate.toFixed(1)}%`,
      projectCount: `${projects.length}件`,
      avgProjectGrossProfit: fmtYen(avgGP),
    });
  }

  const now = new Date();
  const fy = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">粗利管理ダッシュボード</h1>
            <p className="text-xs text-gray-400">{fy}年度</p>
          </div>
        </div>
      </header>
      <main className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="粗利合計"
            value={kpi?.totalGrossProfit ?? "---"}
            subtitle=""
            icon={TrendingUp}
          />
          <KpiCard
            title="平均粗利率"
            value={kpi?.avgGrossProfitRate ?? "---"}
            subtitle=""
            icon={Percent}
          />
          <KpiCard
            title="案件数"
            value={kpi?.projectCount ?? "---"}
            subtitle=""
            icon={BarChart3}
          />
          <KpiCard
            title="平均案件粗利"
            value={kpi?.avgProjectGrossProfit ?? "---"}
            subtitle=""
            icon={Building2}
          />
        </div>
        <RankingTable />
      </main>
    </div>
  );
}
