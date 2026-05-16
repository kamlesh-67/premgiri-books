import { cn } from "@/lib/utils";

export type StatusVariant =
  | "posted"
  | "draft"
  | "cancelled"
  | "due-soon"
  | "info";

const variantClasses: Record<StatusVariant, string> = {
  posted: "bg-success-soft text-success",
  draft: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive-soft text-destructive",
  "due-soon": "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
};

const labelMap: Partial<Record<string, StatusVariant>> = {
  POSTED: "posted",
  PAID: "posted",
  ACTIVE: "posted",
  RECEIVED: "posted",
  FILED: "posted",
  DRAFT: "draft",
  PENDING: "draft",
  CANCELLED: "cancelled",
  OVERDUE: "cancelled",
  ERROR: "cancelled",
  APPROVED: "info",
  PROCESSING: "info",
  UPLOADED: "info",
  "DUE-SOON": "due-soon",
  "LOW STOCK": "due-soon",
  WARNING: "due-soon",
};

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const resolved = variant ?? labelMap[status.toUpperCase()] ?? "draft";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        variantClasses[resolved],
        className
      )}
    >
      {status}
    </span>
  );
}
