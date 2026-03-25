"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Staff = { id: string; name: string };

export default function NewProjectPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    staff_id: "",
    contract_amount: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    supabase
      .from("staff")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setStaffList(data);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("projects").insert({
      name: form.name,
      staff_id: form.staff_id || null,
      contract_amount: Number(form.contract_amount) || 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    });

    if (error) {
      alert("登録に失敗しました: " + error.message);
      setSaving(false);
      return;
    }

    router.push("/projects");
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">新規工事登録</h1>
      <div className="bg-white rounded-lg shadow max-w-xl">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              工事名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              担当者
            </label>
            <select
              value={form.staff_id}
              onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- 選択してください --</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              請負金額（円）<span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="0"
              value={form.contract_amount}
              onChange={(e) =>
                setForm({ ...form, contract_amount: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                着工日
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                完工日
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "登録中..." : "登録する"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/projects")}
              className="border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
