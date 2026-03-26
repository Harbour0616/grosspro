import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

interface ProjectData {
  contract_amount: number | null;
  cost_amount: number | null;
  customer_name: string | null;
  staff_id: string | null;
}

interface ProjectLedgerProps {
  projectId: string;
  projectName: string;
  onBack: () => void;
}

const fmt = (n: number) => n.toLocaleString();

export default function ProjectLedger({ projectId, projectName, onBack }: ProjectLedgerProps) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [staffName, setStaffName] = useState("-");

  useEffect(() => {
    async function load() {
      const { data: pj } = await supabase
        .from("projects")
        .select("contract_amount, cost_amount, customer_name, staff_id")
        .eq("id", projectId)
        .single();
      if (!pj) return;
      setProject(pj);

      if (pj.staff_id) {
        const { data: st } = await supabase.from("staff").select("name").eq("id", pj.staff_id).single();
        if (st) setStaffName(st.name);
      }
    }
    load();
  }, [projectId]);

  const contractAmount = project?.contract_amount ?? 0;
  const costAmount = project?.cost_amount ?? 0;
  const grossProfit = contractAmount - costAmount;
  const grossRate = contractAmount > 0 ? (grossProfit / contractAmount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        戻る
      </button>

      {/* Header card */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <h2 className="text-xl font-bold text-foreground">{projectName}</h2>
        <div className="flex gap-6 mt-2">
          <span className="text-sm text-muted-foreground">顧客: <span className="text-foreground font-medium">{project?.customer_name ?? "-"}</span></span>
          <span className="text-sm text-muted-foreground">担当: <span className="text-foreground font-medium">{staffName}</span></span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-card border border-border p-5">
          <span className="text-xs text-muted-foreground">契約金額</span>
          <p className="text-lg font-bold text-foreground mt-1 tabular-nums">
            {contractAmount > 0 ? fmt(contractAmount) : "未入力"}
          </p>
        </div>
        <div className="rounded-xl bg-card border border-border p-5">
          <span className="text-xs text-muted-foreground">現場経費</span>
          <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{fmt(costAmount)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-5">
          <span className="text-xs text-muted-foreground">粗利金額</span>
          <p className={cn("text-lg font-bold mt-1 tabular-nums", grossProfit < 0 ? "text-destructive" : "text-foreground")}>
            {contractAmount > 0 ? fmt(grossProfit) : "-"}
          </p>
        </div>
        <div className="rounded-xl bg-card border border-border p-5">
          <span className="text-xs text-muted-foreground">粗利率</span>
          <p className={cn("text-lg font-bold mt-1", grossRate < 0 ? "text-destructive" : "text-foreground")}>
            {contractAmount > 0 ? `${grossRate.toFixed(1)}%` : "-"}
          </p>
        </div>
      </div>
    </div>
  );
}
