import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

interface StaffRow {
  id: string;
  name: string;
  role: string | null;
}

export default function Staff() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", role: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("staff").select("id, name, role").order("name");
    if (data) setStaff(data);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("staff").insert({
      name: form.name,
      role: form.role || null,
    });
    setSaving(false);
    if (error) { alert("登録失敗: " + error.message); return; }
    setForm({ name: "", role: "" });
    setShowForm(false);
    load();
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    const { error } = await supabase.from("staff").update({
      name: editForm.name,
      role: editForm.role || null,
    }).eq("id", id);
    setSaving(false);
    if (error) { alert("更新失敗: " + error.message); return; }
    setEditId(null);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) { alert("削除失敗: " + error.message); return; }
    load();
  }

  function startEdit(s: StaffRow) {
    setEditId(s.id);
    setEditForm({ name: s.name, role: s.role ?? "" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">担当者マスタ</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "閉じる" : "新規登録"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">担当者名 *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">役職</label>
              <input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                placeholder="例: 現場監督"
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
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">担当者名</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">役職</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3 w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-kpi-surface/30 transition-colors">
                  {editId === s.id ? (
                    <>
                      <td className="px-6 py-3">
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-input bg-background text-foreground text-sm"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <input
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-input bg-background text-foreground text-sm"
                        />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => handleUpdate(s.id)}
                            disabled={saving}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                            title="保存"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground transition-colors"
                            title="キャンセル"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 font-semibold text-foreground">{s.name}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{s.role ?? "-"}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => startEdit(s)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="編集"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.name)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">
                    担当者データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
