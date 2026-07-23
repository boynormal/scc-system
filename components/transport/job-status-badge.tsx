import { cn } from "@/lib/utils"
import type { TransportJobStatus } from "@prisma/client"

const STATUS_CONFIG: Record<TransportJobStatus, { label: string; className: string }> = {
  pending_assignment: { label: "รอมอบหมาย", className: "bg-amber-100 text-amber-800 border-amber-200" },
  assigned: { label: "มอบหมายแล้ว", className: "bg-blue-100 text-blue-800 border-blue-200" },
  driver_accepted: { label: "คนขับรับงาน", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  en_route: { label: "กำลังเดินทาง", className: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  at_pickup: { label: "ถึงจุดรับ", className: "bg-teal-100 text-teal-800 border-teal-200" },
  loading: { label: "กำลังโหลด", className: "bg-teal-100 text-teal-800 border-teal-200" },
  departed: { label: "ออกเดินทาง", className: "bg-sky-100 text-sky-800 border-sky-200" },
  at_destination: { label: "ถึงปลายทาง", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  unloading: { label: "กำลังขนถ่าย", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  completed: { label: "เสร็จสิ้น", className: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "ยกเลิก", className: "bg-slate-100 text-slate-600 border-slate-200" },
}

export function JobStatusBadge({ status, className }: { status: TransportJobStatus; className?: string }) {
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
