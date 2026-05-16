import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type IconTone = "primary" | "info" | "warning" | "success" | "destructive";

const toneStyles: Record<IconTone, string> = {
  primary: "bg-primary-soft text-primary",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  destructive: "bg-destructive-soft text-destructive",
};

interface KpiCardProps {
  title: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral" | "warning";
  icon: LucideIcon;
  iconTone?: IconTone;
}

export function KpiCard({ title, value, delta, deltaTone = "neutral", icon: Icon, iconTone = "primary" }: KpiCardProps) {
  const deltaClass =
    deltaTone === "up"
      ? "text-success"
      : deltaTone === "down"
      ? "text-destructive"
      : deltaTone === "warning"
      ? "text-warning"
      : "text-muted-foreground";

  const DeltaIcon = deltaTone === "up" ? ArrowUpRight : deltaTone === "down" ? ArrowDownRight : null;

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-full", toneStyles[iconTone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {delta && (
        <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", deltaClass)}>
          {DeltaIcon && <DeltaIcon className="h-3 w-3" />}
          {delta}
        </p>
      )}
    </div>
  );
}
