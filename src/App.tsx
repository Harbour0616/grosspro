import { useEffect, useState } from "react";
import { TrendingUp, Percent, Building2, BarChart3, Menu } from "lucide-react";
import { supabase } from "@/lib/supabase";
import KpiCard from "./components/KpiCard";
import RankingTable from "./components/RankingTable";
import Sidebar from "./components/Sidebar";
import Projects from "./pages/Projects";
import Staff from "./pages/Staff";
import ExcelImport from "./pages/ExcelImport";
import StaffDetail from "./pages/StaffDetail";
import ProjectLedger from "./pages/ProjectLedger";

type Page =
  | "dashboard"
  | "projects"
  | "staff"
  | "import"
  | { name: "staffDetail"; staffId: string; staffName: string }
  | { name: "ledger"; projectId: string; projectName: string };

interface Kpi {
  grossTotal: string;
  avgRate: string;
  count: string;
  salesTotal: string;
}

const fmtMan = (n: number) => `${Math.floor(n / 10000).toLocaleString()}万`;

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const activeSidebar = typeof page === "string" ? page : "dashboard";

  useEffect(() => {
    async function loadKpi() {
      const { data } = await supabase.from("projects").select("contract_amount, cost_amount");
      if (!data) return;
      const active = data.filter((p) => (p.contract_amount ?? 0) > 0);
      const totalContract = active.reduce((s, p) => s + (p.contract_amount ?? 0), 0);
      const totalCost = active.reduce((s, p) => s + (p.cost_amount ?? 0), 0);
      const gross = totalContract - totalCost;
      const rate = totalContract > 0 ? (gross / totalContract) * 100 : 0;
      const count = active.length;
      setKpi({
        grossTotal: fmtMan(gross),
        avgRate: `${rate.toFixed(1)}%`,
        count: `${count}件`,
        salesTotal: fmtMan(totalContract),
      });
    }
    loadKpi();
  }, [page]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar active={activeSidebar} onNavigate={setPage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 overflow-auto min-w-0">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-full mx-auto px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">粗利管理ダッシュボード</h1>
              <p className="text-xs text-muted-foreground">2025年度</p>
            </div>
          </div>
        </header>
        <main className="max-w-full mx-auto px-4 py-6 md:py-8 space-y-6 md:space-y-8">
          {page === "dashboard" && (
            <>
              <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="粗利合計" value={kpi?.grossTotal ?? "---"} icon={TrendingUp} />
                <KpiCard title="平均粗利率" value={kpi?.avgRate ?? "---"} icon={Percent} />
                <KpiCard title="案件数" value={kpi?.count ?? "---"} icon={BarChart3} />
                <KpiCard title="売上合計" value={kpi?.salesTotal ?? "---"} icon={Building2} />
              </div>
              <RankingTable />
            </>
          )}
          {page === "projects" && <Projects />}
          {page === "staff" && <Staff />}
          {page === "import" && <ExcelImport />}
          {typeof page === "object" && page.name === "staffDetail" && (
            <StaffDetail
              staffId={page.staffId}
              staffName={page.staffName}
              onBack={() => setPage("dashboard")}
            />
          )}
          {typeof page === "object" && page.name === "ledger" && (
            <ProjectLedger
              projectId={page.projectId}
              projectName={page.projectName}
              onBack={() => setPage("dashboard")}
            />
          )}
        </main>
      </div>
    </div>
  );
}
