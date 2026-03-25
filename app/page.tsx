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

export default function Dashboard() {
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
      const grossProfitRate = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      return {
        id: s.id,
        name: s.name,
        totalRevenue,
        totalCost,
        grossProfit,
        grossProfitRate,
      };
    });

    summaries.sort((a, b) => b.grossProfitRate - a.grossProfitRate);
    setData(summaries);
    setLoading(false);
  }

  const fmt = (n: number) =>
    n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">担当者別粗利ランキング</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            データがありません。担当者と工事を登録してください。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
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
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-6 py-3 font-semibold text-gray-700">
                    {i + 1}
                  </td>
                  <td className="px-6 py-3 font-medium">{s.name}</td>
                  <td className="px-6 py-3 text-right">{fmt(s.totalRevenue)}</td>
                  <td className="px-6 py-3 text-right">{fmt(s.totalCost)}</td>
                  <td
                    className={`px-6 py-3 text-right font-semibold ${
                      s.grossProfit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {fmt(s.grossProfit)}
                  </td>
                  <td
                    className={`px-6 py-3 text-right font-semibold ${
                      s.grossProfitRate >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {s.grossProfitRate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
