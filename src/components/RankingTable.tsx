import { cn } from "@/lib/utils";
import { Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

function useIsMobile(breakpoint = 768) {
  const subscribe = useCallback((cb: () => void) => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, [breakpoint]);
  const getSnapshot = useCallback(() => window.innerWidth < breakpoint, [breakpoint]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

type SortKey = "grossProfit" | "totalContract" | "projects";

interface RankingEntry {
  staffId: string;
  name: string;
  totalContract: number;
  totalCost: number;
  grossProfit: number;
  profitRate: number;
  projects: number;
  inProgressCount: number;
}

function rateColor(rate: number) {
  if (rate >= 25) return "bg-primary/10 text-primary";
  if (rate > 10) return "bg-kpi-amber/10 text-kpi-amber";
  return "bg-destructive/10 text-destructive";
}

interface ProjectDetail {
  id: string;
  name: string;
  contractAmount: number;
  costAmount: number;
  grossProfit: number;
  profitRate: number;
  endMonth: string | null;
}

interface RankingTableProps {
  onProjectClick?: (projectId: string, projectName: string) => void;
}

const fmtFull = (n: number) => n.toLocaleString();
const fmtMan = (n: number) => `${Math.floor(n / 10000)}万`;

const rankColors: Record<number, string> = {
  1: "text-rank-gold",
  2: "text-rank-silver",
  3: "text-rank-bronze",
};

export default function RankingTable({ onProjectClick }: RankingTableProps) {
  const isMobile = useIsMobile();
  const fmt = isMobile ? fmtMan : fmtFull;
  const [rawData, setRawData] = useState<RankingEntry[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("grossProfit");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ProjectDetail[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: staff } = await supabase.from("staff").select("id, name");
      const { data: projects } = await supabase.from("projects").select("id, staff_id, contract_amount, cost_amount, end_month");
      if (!staff || !projects) return;

      const entries: RankingEntry[] = staff.map((s) => {
        const myProjects = projects.filter((p) => p.staff_id === s.id);
        const totalContract = myProjects.reduce((sum, p) => sum + (p.contract_amount ?? 0), 0);
        const totalCost = myProjects.reduce((sum, p) => sum + (p.cost_amount ?? 0), 0);
        const grossProfit = totalContract - totalCost;
        const profitRate = totalContract > 0 ? (grossProfit / totalContract) * 100 : 0;
        const inProgressCount = myProjects.filter((p) => !p.end_month).length;
        return { staffId: s.id, name: s.name, totalContract, totalCost, grossProfit, profitRate, projects: myProjects.length, inProgressCount };
      });
      setRawData(entries);
    }
    load();
  }, []);

  const data = useMemo(() =>
    [...rawData].sort((a, b) => b[sortKey] - a[sortKey]).map((e, i) => ({ ...e, rank: i + 1 })),
    [rawData, sortKey],
  );

  async function toggleExpand(staffId: string) {
    if (expandedId === staffId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(staffId);
    setLoadingDetail(true);
    const { data: pj } = await supabase.from("projects").select("id, name, contract_amount, cost_amount, end_month").eq("staff_id", staffId);
    if (!pj) { setLoadingDetail(false); return; }

    const rows: ProjectDetail[] = pj.map((p) => {
      const contract = p.contract_amount ?? 0;
      const cost = p.cost_amount ?? 0;
      const grossProfit = contract - cost;
      const profitRate = contract > 0 ? (grossProfit / contract) * 100 : 0;
      return { id: p.id, name: p.name, contractAmount: contract, costAmount: cost, grossProfit, profitRate, endMonth: p.end_month ?? null };
    });
    setDetails(rows);
    setLoadingDetail(false);
  }

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="p-6 pb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">担当者別ランキング</h2>
        </div>
        <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs font-medium">
          {([["grossProfit", "粗利"], ["totalContract", "契約金額"], ["projects", "案件数"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={cn(
                "px-3 py-1.5 transition-colors",
                sortKey === key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-t border-border bg-kpi-surface/50">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 md:px-6 py-3 w-12 md:w-16">順位</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 md:px-6 py-3 min-w-[80px]">担当者</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 md:px-6 py-3 min-w-[90px]">売上</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 md:px-6 py-3 min-w-[90px]">原価</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 md:px-6 py-3 min-w-[90px]">粗利</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 md:px-6 py-3">粗利率</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 md:px-6 py-3">案件数</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => {
              const isOpen = expandedId === entry.staffId;
              return (
                <>
                  <tr
                    key={entry.staffId}
                    onClick={() => toggleExpand(entry.staffId)}
                    className={cn(
                      "border-t border-border cursor-pointer transition-colors",
                      isOpen ? "bg-kpi-surface/60" : "hover:bg-kpi-surface/30"
                    )}
                  >
                    <td className="px-4 md:px-6 py-4">
                      <span className={cn("text-lg font-bold", rankColors[entry.rank] || "text-muted-foreground")}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 font-semibold text-foreground">{entry.name}</td>
                    <td className="px-4 md:px-6 py-4 text-right text-sm text-foreground tabular-nums">{fmt(entry.totalContract)}</td>
                    <td className="px-4 md:px-6 py-4 text-right text-sm text-foreground tabular-nums">{fmt(entry.totalCost)}</td>
                    <td className="px-4 md:px-6 py-4 text-right font-semibold text-foreground tabular-nums">{fmt(entry.grossProfit)}</td>
                    <td className="px-4 md:px-6 py-4 text-right">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        rateColor(entry.profitRate)
                      )}>
                        {entry.profitRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right text-sm text-muted-foreground">{entry.projects}件</td>
                    <td className="px-2 md:px-4 py-4 text-muted-foreground">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${entry.staffId}-detail`}>
                      <td colSpan={8} className="p-0">
                        <div className="bg-kpi-surface/40 px-6 py-4">
                          {loadingDetail ? (
                            <p className="text-sm text-muted-foreground py-2">読み込み中...</p>
                          ) : details.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">担当工事がありません</p>
                          ) : (
                            <table className="w-full">
                              <thead>
                                <tr>
                                  <th className="text-left text-xs font-medium text-muted-foreground pb-2">工事名</th>
                                  <th className="text-right text-xs font-medium text-muted-foreground pb-2">売上</th>
                                  <th className="text-right text-xs font-medium text-muted-foreground pb-2">原価</th>
                                  <th className="text-right text-xs font-medium text-muted-foreground pb-2">粗利</th>
                                  <th className="text-right text-xs font-medium text-muted-foreground pb-2">粗利率</th>
                                </tr>
                              </thead>
                              <tbody>
                                {details.map((d) => (
                                  <tr key={d.id} className="border-t border-border/50">
                                    <td className="py-2 text-sm text-foreground">
                                      <span className="inline-flex items-center gap-2">
                                        {onProjectClick ? (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); onProjectClick(d.id, d.name); }}
                                            className="hover:text-primary hover:underline transition-colors text-left"
                                          >
                                            {d.name}
                                          </button>
                                        ) : d.name}
                                        <span className={cn(
                                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap",
                                          d.endMonth ? "bg-primary/10 text-primary" : "bg-kpi-amber/10 text-kpi-amber"
                                        )}>
                                          {d.endMonth ? "完工" : "進行中"}
                                        </span>
                                      </span>
                                    </td>
                                    <td className="py-2 text-right text-sm text-foreground">{fmt(d.contractAmount)}</td>
                                    <td className="py-2 text-right text-sm text-foreground">{fmt(d.costAmount)}</td>
                                    <td className="py-2 text-right text-sm font-semibold text-foreground">{fmt(d.grossProfit)}</td>
                                    <td className="py-2 text-right">
                                      <span className={cn(
                                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                        rateColor(d.profitRate)
                                      )}>
                                        {d.profitRate.toFixed(1)}%
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
