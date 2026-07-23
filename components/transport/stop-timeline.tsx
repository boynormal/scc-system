import { cn } from "@/lib/utils"
import type { StopStatus } from "@prisma/client"
import { CheckCircle2, Circle, XCircle, SkipForward } from "lucide-react"

const STATUS_CONFIG: Record<StopStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: "รอ", icon: <Circle className="h-5 w-5" />, color: "text-slate-400" },
  arrived: { label: "ถึงแล้ว", icon: <Circle className="h-5 w-5 fill-blue-200" />, color: "text-blue-600" },
  loading: { label: "กำลังโหลด", icon: <Circle className="h-5 w-5 fill-amber-200" />, color: "text-amber-600" },
  completed: { label: "เสร็จ", icon: <CheckCircle2 className="h-5 w-5" />, color: "text-green-600" },
  skipped: { label: "ข้าม", icon: <SkipForward className="h-5 w-5" />, color: "text-slate-400" },
  cancelled: { label: "ยกเลิก", icon: <XCircle className="h-5 w-5" />, color: "text-red-500" },
}

type Stop = {
  id: string
  sequence: number
  customerName: string
  address: string
  contactName?: string | null
  contactPhone?: string | null
  status: StopStatus
  estimatedArrival?: Date | string | null
  actualArrival?: Date | string | null
  weightKg?: { toNumber?: () => number } | number | null
  notes?: string | null
}

export function StopTimeline({ stops }: { stops: Stop[] }) {
  if (stops.length === 0) {
    return <p className="text-sm text-slate-400">ไม่มีจุดแวะ</p>
  }

  return (
    <ol className="space-y-0">
      {stops.map((stop, idx) => {
        const cfg = STATUS_CONFIG[stop.status] ?? STATUS_CONFIG.pending
        const isLast = idx === stops.length - 1
        return (
          <li key={stop.id} className="relative flex gap-4">
            {/* Vertical line */}
            {!isLast && (
              <div className="absolute left-[18px] top-8 h-full w-0.5 bg-slate-200" aria-hidden />
            )}
            {/* Icon */}
            <div className={cn("relative z-10 mt-0.5 shrink-0", cfg.color)}>{cfg.icon}</div>
            {/* Content */}
            <div className="mb-6 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-slate-400">Stop {stop.sequence}</span>
                  <h4 className="font-semibold text-slate-900">{stop.customerName}</h4>
                  <p className="mt-0.5 text-sm text-slate-600">{stop.address}</p>
                </div>
                <span className={cn("shrink-0 text-xs font-medium", cfg.color)}>{cfg.label}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                {stop.contactName && <span>ติดต่อ: {stop.contactName}</span>}
                {stop.contactPhone && <span>โทร: {stop.contactPhone}</span>}
                {stop.weightKg != null && (
                  <span>
                    น้ำหนัก:{" "}
                    {(typeof stop.weightKg === "object" && stop.weightKg !== null && "toNumber" in stop.weightKg
                      ? (stop.weightKg as { toNumber: () => number }).toNumber()
                      : Number(stop.weightKg)
                    ).toLocaleString()}{" "}
                    กก.
                  </span>
                )}
                {stop.actualArrival && (
                  <span>ถึงจริง: {new Date(stop.actualArrival).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</span>
                )}
              </div>
              {stop.notes && <p className="mt-2 text-xs text-slate-500 italic">{stop.notes}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
