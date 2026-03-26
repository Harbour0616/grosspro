import { useState } from "react";
import { TrendingUp, Percent, Building2, BarChart3 } from "lucide-react";
import KpiCard from "./components/KpiCard";
import RankingTable from "./components/RankingTable";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [page, setPage] = useState("dashboard");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar active={page} onNavigate={setPage} />
      <div className="flex-1 overflow-auto">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">粗利管理ダッシュボード</h1>
              <p className="text-xs text-muted-foreground">2025年度</p>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
          {page === "dashboard" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="粗利合計" value="¥1.52億" subtitle="前年同期比" icon={TrendingUp} trend={{ value: "12.3%", positive: true }} />
                <KpiCard title="平均粗利率" value="25.0%" subtitle="目標: 23.0%" icon={Percent} trend={{ value: "2.0pt", positive: true }} />
                <KpiCard title="案件数" value="44件" subtitle="完了: 38件 / 進行中: 6件" icon={BarChart3} trend={{ value: "8件", positive: true }} />
                <KpiCard title="平均案件粗利" value="¥345万" subtitle="前年: ¥310万" icon={Building2} trend={{ value: "11.3%", positive: true }} />
              </div>
              <RankingTable />
            </>
          )}
          {page === "projects" && (
            <div className="text-center text-muted-foreground py-16">工事一覧（実装予定）</div>
          )}
          {page === "staff" && (
            <div className="text-center text-muted-foreground py-16">担当者マスタ（実装予定）</div>
          )}
          {page === "import" && (
            <div className="text-center text-muted-foreground py-16">Excelインポート（実装予定）</div>
          )}
        </main>
      </div>
    </div>
  );
}
