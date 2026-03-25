"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Staff = { id: string; name: string };

type Project = {
  id: string;
  name: string;
  contract_amount: number;
  start_date: string | null;
  end_date: string | null;
  staff: { name: string } | null;
};

type CostRow = {
  id: string;
  category: string;
  amount: number;
  memo: string;
};

const CATEGORIES = ["材料費", "外注費", "労務費", "その他経費"];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [editingStaff, setEditingStaff] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [savingStaff, setSavingStaff] = useState(false);

  const [newCost, setNewCost] = useState({
    category: CATEGORIES[0],
    amount: "",
    memo: "",
  });

  useEffect(() => {
    fetchProject();
    fetchCosts();
    supabase.from("staff").select("id, name").order("name").then(({ data }) => {
      if (data) setStaffList(data);
    });
  }, [id]);

  async function fetchProject() {
    const { data } = await supabase
      .from("projects")
      .select("id, name, contract_amount, start_date, end_date, staff:staff_id(name)")
      .eq("id", id)
      .single();
    if (data) {
      const staffArr = data.staff as unknown;
      const staff = Array.isArray(staffArr) ? staffArr[0] ?? null : staffArr;
      setProject({ ...data, staff } as Project);
    }
    setLoading(false);
  }

  async function fetchCosts() {
    const { data } = await supabase
      .from("project_costs")
      .select("id, category, amount, memo")
      .eq("project_id", id)
      .order("created_at", { ascending: true });
    if (data) setCosts(data);
  }

  async function handleAddCost(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("project_costs").insert({
      project_id: id,
      category: newCost.category,
      amount: Number(newCost.amount) || 0,
      memo: newCost.memo,
    });
    if (error) {
      alert("登録に失敗しました: " + error.message);
    } else {
      setNewCost({ category: CATEGORIES[0], amount: "", memo: "" });
      fetchCosts();
    }
    setSaving(false);
  }

  async function handleSaveStaff() {
    setSavingStaff(true);
    const { error } = await supabase
      .from("projects")
      .update({ staff_id: selectedStaffId || null })
      .eq("id", id);
    if (error) {
      alert("更新に失敗しました: " + error.message);
    } else {
      setEditingStaff(false);
      fetchProject();
    }
    setSavingStaff(false);
  }

  async function handleDeleteCost(costId: string) {
    if (!confirm("この原価を削除しますか？")) return;
    await supabase.from("project_costs").delete().eq("id", costId);
    fetchCosts();
  }

  const fmt = (n: number) =>
    n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });

  if (loading) {
    return <div className="text-gray-500">読み込み中...</div>;
  }

  if (!project) {
    return <div className="text-red-500">工事が見つかりません。</div>;
  }

  const totalCost = costs.reduce((sum, c) => sum + c.amount, 0);
  const grossProfit = project.contract_amount - totalCost;
  const grossProfitRate =
    project.contract_amount > 0
      ? (grossProfit / project.contract_amount) * 100
      : 0;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/projects"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; 工事一覧に戻る
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">{project.name}</h1>

      {/* 工事情報サマリー */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">工事情報</h2>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500">担当者</div>
            {editingStaff ? (
              <div className="flex items-center gap-2 mt-1">
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- 未割当 --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleSaveStaff}
                  disabled={savingStaff}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingStaff(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="font-medium flex items-center gap-2">
                {project.staff?.name ?? "未割当"}
                <button
                  onClick={() => setEditingStaff(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  編集
                </button>
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500">請負金額</div>
            <div className="font-medium">{fmt(project.contract_amount)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">着工日</div>
            <div className="font-medium">{project.start_date ?? "未定"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">完工日</div>
            <div className="font-medium">{project.end_date ?? "未定"}</div>
          </div>
        </div>
        <div className="px-6 pb-6 grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-md p-3">
            <div className="text-xs text-gray-500">原価合計</div>
            <div className="text-lg font-bold">{fmt(totalCost)}</div>
          </div>
          <div className="bg-gray-50 rounded-md p-3">
            <div className="text-xs text-gray-500">粗利</div>
            <div
              className={`text-lg font-bold ${
                grossProfit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {fmt(grossProfit)}
            </div>
          </div>
          <div className="bg-gray-50 rounded-md p-3">
            <div className="text-xs text-gray-500">粗利率</div>
            <div
              className={`text-lg font-bold ${
                grossProfitRate >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {grossProfitRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* 原価内訳 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">原価内訳</h2>
        </div>
        {costs.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            原価が登録されていません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">カテゴリ</th>
                <th className="px-6 py-3 font-medium text-right">金額</th>
                <th className="px-6 py-3 font-medium">メモ</th>
                <th className="px-6 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-6 py-3">
                    <span className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
                      {c.category}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-medium">
                    {fmt(c.amount)}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{c.memo}</td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleDeleteCost(c.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 原価追加フォーム */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">原価追加</h2>
        </div>
        <form onSubmit={handleAddCost} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                カテゴリ
              </label>
              <select
                value={newCost.category}
                onChange={(e) =>
                  setNewCost({ ...newCost, category: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                金額（円）
              </label>
              <input
                type="number"
                min="0"
                required
                value={newCost.amount}
                onChange={(e) =>
                  setNewCost({ ...newCost, amount: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メモ
              </label>
              <input
                type="text"
                value={newCost.memo}
                onChange={(e) =>
                  setNewCost({ ...newCost, memo: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "追加中..." : "追加"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
