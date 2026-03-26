"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type StaffSummary = {
  id: string;
  name: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossProfitRate: number;
};

export default function RankingTable() {
  const [data, setData] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: staff } = await supabase.from("staff").select("id, name");
    const { data: projects } = await supabase
      .from("projects")
      .select("id, staff_id, contract_amount");
    const { data: costs } = await supabase
      .from("project_costs")
      .select("project_id, amount");

    if (!staff || !projects) {
      setLoading(false);
      return;
    }

    const costByProject = new Map<string, number>();
    (costs ?? []).forEach((c) => {
      costByProject.set(
        c.project_id,
        (costByProject.get(c.project_id) ?? 0) + c.amount
      );
    });

    const summaries: StaffSummary[] = staff.map((s) => {
      const staffProjects = projects.filter((p) => p.staff_id === s.id);
      const totalRevenue = staffProjects.reduce(
        (sum, p) => sum + (p.contract_amount ?? 0),
        0
      );
      const totalCost = staffProjects.reduce(
        (sum, p) => sum + (costByProject.get(p.id) ?? 0),
        0
      );
      const grossProfit = totalRevenue - totalCost;
      const grossProfitRate =
        totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      return { id: s.id, name: s.name, totalRevenue, totalCost, grossProfit, grossProfitRate };
    });

    summaries.sort((a, b) => b.grossProfitRate - a.grossProfitRate);
    setData(summaries);
    setLoading(false);
  }

  const fmt = (n: number) =>
    n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">
          担当者別粗利ランキング
        </h2>
      </div>
      {loading ? (
        <div className="p-8 text-center text-gray-400">読み込み中...</div>
      ) : data.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          データがありません。担当者と工事を登録してください。
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-400 text-xs">
              <th className="px-6 py-3 font-medium">順位</th>
              <th className="px-6 py-3 font-medium">担当者名</th>
              <th className="px-6 py-3 font-medium text-right">売上合計</th>
              <th className="px-6 py-3 font-medium text-right">原価合計</th>
              <th className="px-6 py-3 font-medium text-right">粗利</th>
              <th className="px-6 py-3 font-medium text-right">粗利率</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s, i) => (
              <tr
                key={s.id}
                className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
              >
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      i === 0
                        ? "bg-yellow-100 text-yellow-700"
                        : i === 1
                          ? "bg-gray-200 text-gray-600"
                          : i === 2
                            ? "bg-amber-100 text-amber-700"
                            : "text-gray-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="px-6 py-3 font-medium text-gray-900">
                  {s.name}
                </td>
                <td className="px-6 py-3 text-right text-gray-600">
                  {fmt(s.totalRevenue)}
                </td>
                <td className="px-6 py-3 text-right text-gray-600">
                  {fmt(s.totalCost)}
                </td>
                <td
                  className={`px-6 py-3 text-right font-semibold ${
                    s.grossProfit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {fmt(s.grossProfit)}
                </td>
                <td className="px-6 py-3 text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      s.grossProfitRate >= 25
                        ? "bg-green-50 text-green-700"
                        : s.grossProfitRate >= 15
                          ? "bg-yellow-50 text-yellow-700"
                          : "bg-red-50 text-red-700"
                    }`}
                  >
                    {s.grossProfitRate.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
