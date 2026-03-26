import { BarChart3, HardHat, Users, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "dashboard", label: "ダッシュボード", icon: BarChart3 },
  { id: "projects", label: "工事一覧", icon: HardHat },
  { id: "staff", label: "担当者マスタ", icon: Users },
  { id: "import", label: "Excelインポート", icon: FileSpreadsheet },
];

interface SidebarProps {
  active: string;
  onNavigate: (id: string) => void;
}

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="w-56 min-h-screen bg-primary text-primary-foreground flex flex-col">
      <div className="px-5 py-5 border-b border-primary-foreground/10">
        <h1 className="text-base font-bold tracking-tight">粗利管理システム</h1>
      </div>
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                    isActive
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
