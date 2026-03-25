"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Staff = {
  id: string;
  name: string;
  role: string;
};

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", role: "" });

  useEffect(() => {
    fetchStaff();
  }, []);

  async function fetchStaff() {
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .order("created_at", { ascending: true });
    if (data) setStaffList(data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("staff")
        .update({ name: form.name, role: form.role })
        .eq("id", editingId);
      if (error) {
        alert("更新に失敗しました: " + error.message);
      } else {
        setEditingId(null);
        setForm({ name: "", role: "" });
        fetchStaff();
      }
    } else {
      const { error } = await supabase
        .from("staff")
        .insert({ name: form.name, role: form.role });
      if (error) {
        alert("登録に失敗しました: " + error.message);
      } else {
        setForm({ name: "", role: "" });
        fetchStaff();
      }
    }

    setSaving(false);
  }

  function handleEdit(staff: Staff) {
    setEditingId(staff.id);
    setForm({ name: staff.name, role: staff.role ?? "" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm({ name: "", role: "" });
  }

  async function handleDelete(id: string) {
    if (!confirm("この担当者を削除しますか？")) return;
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
    } else {
      fetchStaff();
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">担当者マスタ</h1>

      {/* 登録・編集フォーム */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {editingId ? "担当者編集" : "新規担当者登録"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                氏名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                役職
              </label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="例: 現場監督、営業"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving
                  ? "保存中..."
                  : editingId
                    ? "更新する"
                    : "登録する"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* 一覧 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">担当者一覧</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : staffList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            担当者が登録されていません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">氏名</th>
                <th className="px-6 py-3 font-medium">役職</th>
                <th className="px-6 py-3 font-medium w-32"></th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-6 py-3 font-medium">{s.name}</td>
                  <td className="px-6 py-3 text-gray-600">{s.role || "-"}</td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(s)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        削除
                      </button>
                    </div>
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
