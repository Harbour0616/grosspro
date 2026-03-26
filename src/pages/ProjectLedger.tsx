import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ArrowLeft, FileText } from "lucide-react";

interface CostRow {
  id: string;
  vendor_name: string | null;
  item_name: string | null;
  amount: number | null;
  memo: string | null;
}

interface ProjectData {
  sales_amount: number | null;
  customer_name: string | null;
  staff_id: string | null;
}

interface ProjectLedgerProps {
  projectId: string;
  projectName: string;
  onBack: () => void;
}

const fmtYen = (n: number) => `¥${n.toLocaleString()}`;

export default function ProjectLedger({ projectId, projectName, onBack }: ProjectLedgerProps) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [staffName, setStaffName] = useState("-");

  useEffect(() => {
    async function load() {
      const { data: pj } = await supabase
        .from("projects")
        .select("sales_amount, customer_name, staff_id")
        .eq("id", projectId)
        .single();
      if (!pj) return;
      setProject(pj);

      if (pj.staff_id) {
        const { data: st } = await supabase
          .from("staff")
          .select("name")
          .eq("id", pj.staff_id)
          .single();
        if (st) setStaffName(st.name);
      }

      const { data: c } = await supabase
        .from("project_costs")
        .select("id, vendor_name, item_name, amount, memo")
        .eq("project_id", projectId)
        .order("id");
      if (c) setCosts(c);
    }
    load();
  }, [projectId]);

  const salesAmount = project?.sales_amount ?? 0;
  const totalCost = costs.reduce((s, c) => s + (c.amount ?? 0), 0);
  const grossProfit = salesAmount - totalCost;
  const grossRate = salesAmount > 0 ? (grossProfit / salesAmount) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        戻る
      </button>

      {/* Header card */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="p-6 pb-4 flex items-center gap-3 border-b border-border">
          <FileText className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-bold text-foreground">工事台帳</h2>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="px-6 py-4">
            <span className="text-xs text-muted-foreground">工事名</span>
            <p className="text-sm font-semibold text-foreground mt-0.5">{projectName}</p>
          </div>
          <div className="px-6 py-4">
            <span className="text-xs text-muted-foreground">顧客名</span>
            <p className="text-sm font-semibold text-foreground mt-0.5">{project?.customer_name ?? "-"}</p>
          </div>
          <div className="px-6 py-4">
            <span className="text-xs text-muted-foreground">担当者</span>
            <p className="text-sm font-semibold text-foreground mt-0.5">{staffName}</p>
          </div>
        </div>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="p-6 pb-4">
          <h3 className="text-base font-bold text-foreground">採算内訳</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-border bg-kpi-surface/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">項目</th>
                <th className="text-center text-xs font-medium text-muted-foreground px-6 py-3 w-16">記号</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3 w-48">金額</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-t border-border">
                <td className="px-6 py-3 text-foreground">契約金額（税込）</td>
                <td className="px-6 py-3 text-center text-muted-foreground">a</td>
                <td className="px-6 py-3 text-right font-medium text-foreground">{fmtYen(salesAmount)}</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-6 py-3 text-foreground">現場経費合計</td>
                <td className="px-6 py-3 text-center text-muted-foreground">f</td>
                <td className="px-6 py-3 text-right font-medium text-foreground">{fmtYen(totalCost)}</td>
              </tr>
              <tr className="border-t-2 border-border bg-kpi-surface/30">
                <td className="px-6 py-3 font-bold text-foreground">粗利金額</td>
                <td className="px-6 py-3 text-center text-muted-foreground">(a)−f</td>
                <td className={cn("px-6 py-3 text-right font-bold", grossProfit < 0 ? "text-destructive" : "text-foreground")}>
                  {fmtYen(grossProfit)}
                </td>
              </tr>
              <tr className="border-t border-border bg-kpi-surface/30">
                <td className="px-6 py-3 font-bold text-foreground">粗利率</td>
                <td className="px-6 py-3" />
                <td className="px-6 py-3 text-right">
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                    grossRate >= 25 ? "bg-primary/10 text-primary" : grossRate < 0 ? "bg-destructive/10 text-destructive" : "bg-kpi-amber/10 text-kpi-amber"
                  )}>
                    {grossRate.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost detail card */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="p-6 pb-4">
          <h3 className="text-base font-bold text-foreground">原価明細</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-border bg-kpi-surface/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">業者名</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">工種</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3 w-40">金額</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">メモ</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {costs.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-kpi-surface/30 transition-colors">
                  <td className="px-6 py-3 text-foreground">{c.vendor_name ?? "-"}</td>
                  <td className="px-6 py-3 text-foreground">{c.item_name ?? "-"}</td>
                  <td className="px-6 py-3 text-right font-medium text-foreground">{fmtYen(c.amount ?? 0)}</td>
                  <td className="px-6 py-3 text-muted-foreground">{c.memo ?? ""}</td>
                </tr>
              ))}
              {costs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    原価データがありません
                  </td>
                </tr>
              )}
              {costs.length > 0 && (
                <tr className="border-t-2 border-border bg-kpi-surface font-bold">
                  <td className="px-6 py-3 text-foreground" colSpan={2}>合計</td>
                  <td className="px-6 py-3 text-right text-foreground">{fmtYen(totalCost)}</td>
                  <td className="px-6 py-3" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
