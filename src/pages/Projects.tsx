import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Plus, X, Pencil } from "lucide-react";

interface Staff {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  customer_name: string | null;
  staff_id: string | null;
  contract_amount: number | null;
  sales_amount: number | null;
  staff?: Staff;
  totalCost: number;
  grossProfit: number;
  profitRate: number;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    customer_name: "",
    staff_id: "",
    contract_amount: "",
  });
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    customer_name: "",
    staff_id: "",
    sales_amount: "",
  });

  async function load() {
    const [{ data: pj }, { data: st }, { data: costs }] = await Promise.all([
      supabase.from("projects").select("id, name, customer_name, staff_id, contract_amount, sales_amount"),
      supabase.from("staff").select("id, name"),
      supabase.from("project_costs").select("project_id, amount"),
    ]);
    if (!pj || !st) return;
    setStaffList(st);

    const mapped: Project[] = pj.map((p) => {
      const totalCost = (costs ?? [])
        .filter((c) => c.project_id === p.id)
        .reduce((sum, c) => sum + (c.amount ?? 0), 0);
      const sales = p.sales_amount ?? 0;
      const grossProfit = sales - totalCost;
      const profitRate = sales > 0 ? (grossProfit / sales) * 100 : 0;
      return {
        ...p,
        staff: st.find((s) => s.id === p.staff_id),
        totalCost,
        grossProfit,
        profitRate,
      };
    });
    setProjects(mapped);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("projects").insert({
      name: form.name,
      customer_name: form.customer_name || null,
      staff_id: form.staff_id || null,
      contract_amount: form.contract_amount ? Number(form.contract_amount) : null,
    });
    setSaving(false);
    if (error) { alert("登録失敗: " + error.message); return; }
    setForm({ name: "", customer_name: "", staff_id: "", contract_amount: "" });
    setShowForm(false);
    load();
  }

  function openEdit(p: Project) {
    setEditTarget(p);
    setEditForm({
      name: p.name,
      customer_name: p.customer_name ?? "",
      staff_id: p.staff_id ?? "",
      sales_amount: p.sales_amount != null ? String(p.sales_amount) : "",
    });
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    const { error } = await supabase.from("projects").update({
      name: editForm.name,
      customer_name: editForm.customer_name || null,
      staff_id: editForm.staff_id || null,
      sales_amount: editForm.sales_amount ? Number(editForm.sales_amount) : null,
    }).eq("id", editTarget.id);
    setSaving(false);
    if (error) { alert("更新失敗: " + error.message); return; }
    setEditTarget(null);
    load();
  }

  const formatYen = (n: number) =>
    n >= 100000000
      ? `¥${(n / 100000000).toFixed(2)}億`
      : `¥${(n / 10000).toFixed(0)}万`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">工事一覧</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "閉じる" : "新規登録"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">工事名 *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">顧客名</label>
              <input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">担当者</label>
              <select
                value={form.staff_id}
                onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
              >
                <option value="">未選択</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">請負金額</label>
              <input
                type="number"
                value={form.contract_amount}
                onChange={(e) => setForm({ ...form, contract_amount: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                placeholder="例: 50000000"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "登録中..." : "登録"}
          </button>
        </form>
      )}

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-kpi-surface/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">工事名</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">顧客名</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">担当者</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">請負金額</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">売上金額</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">粗利</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">粗利率</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3 w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-kpi-surface/30 transition-colors">
                  <td className="px-6 py-4 font-semibold text-foreground">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{p.customer_name ?? "-"}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{p.staff?.name ?? "-"}</td>
                  <td className="px-6 py-4 text-right text-sm text-foreground">
                    {p.contract_amount ? formatYen(p.contract_amount) : "-"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-foreground">
                    {p.sales_amount ? formatYen(p.sales_amount) : "-"}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{formatYen(p.grossProfit)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      p.profitRate >= 25 ? "bg-primary/10 text-primary" : "bg-kpi-amber/10 text-kpi-amber"
                    )}>
                      {p.profitRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      title="編集"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    工事データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditTarget(null)} />
          <form
            onSubmit={handleEditSave}
            className="relative z-10 w-full max-w-lg rounded-2xl bg-card border border-border p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">工事編集</h3>
              <button type="button" onClick={() => setEditTarget(null)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">工事名 *</label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">顧客名</label>
                <input
                  value={editForm.customer_name}
                  onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">担当者</label>
                <select
                  value={editForm.staff_id}
                  onChange={(e) => setEditForm({ ...editForm, staff_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                >
                  <option value="">未選択</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">売上金額</label>
                <input
                  type="number"
                  value={editForm.sales_amount}
                  onChange={(e) => setEditForm({ ...editForm, sales_amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                  placeholder="例: 50000000"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
