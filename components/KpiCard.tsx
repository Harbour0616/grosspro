import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
}
const KpiCard = ({ title, value, subtitle, icon: Icon, trend }: KpiCardProps) => (
  <div className="rounded-2xl bg-card border border-border p-6 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-muted-foreground">{title}</span>
      <div className="w-10 h-10 rounded-xl bg-kpi-surface flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
    </div>
    <div className="flex items-end gap-2">
      <span className="text-3xl font-bold tracking-tight text-foreground">{value}</span>
      {trend && (
        <span className={cn("text-sm font-medium mb-1", trend.positive ? "text-kpi-green" : "text-destructive")}>
          {trend.positive ? "↑" : "↓"} {trend.value}
        </span>
      )}
    </div>
    {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
  </div>
);
export default KpiCard;
