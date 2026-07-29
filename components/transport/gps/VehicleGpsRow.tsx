import Link from "next/link"
import { cn } from "@/lib/utils"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { GpsAlertBadge, GpsStatusDot, hasAnyAlert } from "./GpsAlertBadge"
import { parseSignalPercent, formatBatteryLabel, formatMileageLabel, getMovementStatus, buildCalendarTodayHref } from "./gps-display-utils"

type Props = {
  vehicle: GpsVehicleData
  selected?: boolean
  onClick?: () => void
}

export function VehicleGpsRow({ vehicle: v, selected, onClick }: Props) {
  const hasAlert = hasAnyAlert(v.alerts)
  const movement = getMovementStatus(v)
  const gsmPct = parseSignalPercent(v.gsm)
  const batteryLabel = formatBatteryLabel(v.battery)
  const mileageLabel = formatMileageLabel(v.mileage)
  const calendarHref = buildCalendarTodayHref(v.vehicleDbId)

  return (
    <tr
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-colors",
        selected && "bg-cyan-50 dark:bg-cyan-950/40",
        hasAlert && !selected && "bg-red-50/60 dark:bg-red-950/30",
        !selected && !hasAlert && "hover:bg-muted/60"
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <GpsStatusDot online={v.online} engineOn={v.engineOn} speed={v.speed} status={v.status} />
          <span className="font-medium text-foreground">{v.plateNumber || "—"}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
            v.available ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"
          )}
        >
          {v.available ? "ว่าง" : "ไม่ว่าง"}
        </span>
      </td>

      <td className="px-4 py-3 text-sm text-foreground">
        {gsmPct !== null ? (
          <div className="flex items-center gap-2 min-w-[80px]">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  gsmPct > 30 ? "bg-green-500" : gsmPct > 15 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${gsmPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{gsmPct}%</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      <td className="px-4 py-3 text-sm max-w-[180px]">
        <span
          className={cn(
            "inline-flex max-w-full rounded-md px-2 py-0.5 text-[11px] font-medium leading-snug truncate",
            movement.className
          )}
          title={movement.label}
        >
          {movement.label}
        </span>
      </td>

      <td className="px-4 py-3 text-sm text-muted-foreground">
        <span className={cn(v.speed > 90 ? "font-bold text-red-600" : "")}>{v.speed} km/h</span>
      </td>

      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {mileageLabel ?? "—"}
      </td>

      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {batteryLabel ?? "—"}
      </td>

      <td className="px-4 py-3 text-sm">
        {calendarHref ? (
          <Link
            href={calendarHref}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
          >
            {v.todayJobCount > 0 ? `${v.todayJobCount} ใบงาน` : "ไม่มีใบงาน"}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[180px]">
        <span className="line-clamp-2">{v.address || "—"}</span>
      </td>

      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{v.lastUpdate || "—"}</td>

      <td className="px-4 py-3">
        <GpsAlertBadge alerts={v.alerts} compact />
      </td>
    </tr>
  )
}
