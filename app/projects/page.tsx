"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProjectRow = {
  id: string;
  name: string;
  staffName: string;
  contractAmount: number;
  totalCost: number;
  grossProfit: number;
  grossProfitRate: number;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    const { data: projectData } = await supabase
      .from("projects")
      .select("id, name, contract_amount, staff:staff_id(name)")
      .order("created_at", { ascending: false });

    const { data: costs } = await supabase
      .from("project_costs")
      .select("project_id, amount");

    if (!projectData) {
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

    const rows: ProjectRow[] = projectData.map((p) => {
      const totalCost = costByProject.get(p.id) ?? 0;
      const grossProfit = (p.contract_amount ?? 0) - totalCost;
      const grossProfitRate =
        p.contract_amount > 0 ? (grossProfit / p.contract_amount) * 100 : 0;
      const staffRaw = p.staff as unknown;
      const staff = Array.isArray(staffRaw) ? staffRaw[0] ?? null : staffRaw as { name: string } | null;
      return {
        id: p.id,
        name: p.name,
        staffName: staff?.name ?? "未割当",
        contractAmount: p.contract_amount ?? 0,
        totalCost,
        grossProfit,
        grossProfitRate,
      };
    });

    setProjects(rows);
    setLoading(false);
  }

  const fmt = (n: number) =>
    n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">工事一覧</h1>
        <Link
          href="/projects/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + 新規工事登録
        </Link>
      </div>
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            工事が登録されていません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">工事名</th>
                <th className="px-6 py-3 font-medium">担当者</th>
                <th className="px-6 py-3 font-medium text-right">請負金額</th>
                <th className="px-6 py-3 font-medium text-right">原価合計</th>
                <th className="px-6 py-3 font-medium text-right">粗利</th>
                <th className="px-6 py-3 font-medium text-right">粗利率</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3">{p.staffName}</td>
                  <td className="px-6 py-3 text-right">
                    {fmt(p.contractAmount)}
                  </td>
                  <td className="px-6 py-3 text-right">{fmt(p.totalCost)}</td>
                  <td
                    className={`px-6 py-3 text-right font-semibold ${
                      p.grossProfit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {fmt(p.grossProfit)}
                  </td>
                  <td
                    className={`px-6 py-3 text-right font-semibold ${
                      p.grossProfitRate >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {p.grossProfitRate.toFixed(1)}%
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
