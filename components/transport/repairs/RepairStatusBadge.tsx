import { cn } from "@/lib/utils"

export type RepairStatus = "reported" | "in_repair" | "inspection" | "closed" | "cancelled"

const STATUS_CONFIG: Record<RepairStatus, { label: string; className: string }> = {
  reported: { label: "แจ้งซ่อม", className: "bg-sky-100 text-sky-800 border-sky-200" },
  in_repair: { label: "กำลังซ่อม", className: "bg-amber-100 text-amber-800 border-amber-200" },
  inspection: {
    label: "ตรวจสอบ",
    className: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
  },
  closed: { label: "ปิดงาน", className: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "ยกเลิก", className: "bg-muted text-muted-foreground border-border" },
}

export function RepairStatusBadge({ status, className }: { status: RepairStatus; className?: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-muted text-muted-foreground" }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
