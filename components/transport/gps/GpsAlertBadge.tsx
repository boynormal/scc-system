import { cn } from "@/lib/utils"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"

const ALERT_CONFIG = [
  { key: "overSpeed" as const, label: "ความเร็วเกิน", short: "Speed" },
  { key: "offRoute" as const, label: "ออกเส้นทาง", short: "Route" },
  { key: "overPark" as const, label: "จอดนาน", short: "Park" },
  { key: "overEngine" as const, label: "เครื่องยนต์เกิน", short: "Engine" },
  { key: "checkZone" as const, label: "เข้าเขตตรวจ", short: "Zone" },
]

type Alerts = GpsVehicleData["alerts"]

export function hasAnyAlert(alerts: Alerts): boolean {
  return Object.values(alerts).some(Boolean)
}

export function GpsAlertBadge({
  alerts,
  compact = false,
  className,
}: {
  alerts: Alerts
  compact?: boolean
  className?: string
}) {
  const active = ALERT_CONFIG.filter((a) => alerts[a.key])
  if (active.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {active.map((a) => (
        <span
          key={a.key}
          className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 border border-red-200"
          title={a.label}
        >
          {compact ? a.short : a.label}
        </span>
      ))}
    </div>
  )
}

export function GpsStatusDot({
  online,
  engineOn,
  speed,
  status,
}: {
  online: boolean
  engineOn: boolean
  speed: number
  status?: string
}) {
  const title = status?.trim() || undefined
  if (!online) return <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" title={title ?? "OFFLINE"} />
  if (speed > 0) return <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" title={title ?? "กำลังวิ่ง"} />
  if (engineOn) return <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" title={title ?? "จอดเครื่องติด"} />
  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" title={title ?? "จอดเครื่องดับ"} />
}
