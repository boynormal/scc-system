import { cn } from "@/lib/utils"
import type { VehicleStatus } from "@prisma/client"

const STATUS_CONFIG: Record<VehicleStatus, { label: string; className: string }> = {
  available: { label: "พร้อมใช้", className: "bg-green-100 text-green-800 border-green-200" },
  on_job: { label: "กำลังใช้งาน", className: "bg-blue-100 text-blue-800 border-blue-200" },
  maintenance: { label: "ซ่อมบำรุง", className: "bg-amber-100 text-amber-800 border-amber-200" },
  inactive: { label: "ไม่ใช้งาน", className: "bg-slate-100 text-slate-600 border-slate-200" },
}

export function VehicleStatusBadge({ status, className }: { status: VehicleStatus; className?: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-slate-100 text-slate-600" }
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
