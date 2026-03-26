import { useState } from "react";
import { TrendingUp, Percent, Building2, BarChart3, Menu } from "lucide-react";
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

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeSidebar = typeof page === "string" ? page : "dashboard";

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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <KpiCard title="粗利合計" value="152,000,000円" subtitle="前年同期比" icon={TrendingUp} trend={{ value: "12.3%", positive: true }} />
                <KpiCard title="平均粗利率" value="25.0%" subtitle="目標: 23.0%" icon={Percent} trend={{ value: "2.0pt", positive: true }} />
                <KpiCard title="案件数" value="44件" subtitle="完了: 38件 / 進行中: 6件" icon={BarChart3} trend={{ value: "8件", positive: true }} />
                <KpiCard title="平均案件粗利" value="3,450,000円" subtitle="前年: 3,100,000円" icon={Building2} trend={{ value: "11.3%", positive: true }} />
              </div>
              <RankingTable onProjectClick={(id, name) => setPage({ name: "ledger", projectId: id, projectName: name })} />
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
