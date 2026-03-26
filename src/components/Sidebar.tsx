import { BarChart3, HardHat, Users, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "dashboard", label: "ダッシュボード", icon: BarChart3, mobileOnly: true },
  { id: "projects", label: "工事一覧", icon: HardHat, mobileOnly: false },
  { id: "import", label: "Excel台帳インポート", icon: FileSpreadsheet, mobileOnly: false },
  { id: "staff", label: "担当者マスタ", icon: Users, mobileOnly: false },
];

interface SidebarProps {
  active: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNavigate: (id: any) => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ active, onNavigate, open, onClose }: SidebarProps) {
  return (
    <>
      {/* Overlay (mobile only) */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 bg-primary text-primary-foreground flex flex-col transition-transform duration-200 md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-5 py-5 border-b border-primary-foreground/10">
          <h1 className="text-base font-bold tracking-tight">粗利管理システム</h1>
        </div>
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = active === item.id;
              return (
                <li key={item.id} className={cn(!item.mobileOnly && "hidden md:block")}>
                  <button
                    onClick={() => { onNavigate(item.id); onClose(); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left min-h-[44px]",
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
    </>
  );
}
