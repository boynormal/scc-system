"use client"

import Link from "next/link"
import { Car, Truck, MapPin, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { GpsAlertBadge, hasAnyAlert } from "./GpsAlertBadge"
import { GsmSignalBar } from "./GsmSignalBar"
import {
  buildCalendarTodayHref,
  formatBatteryLabel,
  formatMileageLabel,
  getMovementStatus,
} from "./gps-display-utils"

type Props = {
  vehicle: GpsVehicleData
  compact?: boolean
  batteryShort?: boolean
  showAlerts?: boolean
  onJobLinkClick?: (e: React.MouseEvent) => void
}

export function VehicleGpsCard({ vehicle: v, compact = false, batteryShort = false, showAlerts = true, onJobLinkClick }: Props) {
  const movement = getMovementStatus(v)
  const batteryLabel = formatBatteryLabel(v.battery, { short: batteryShort })
  const mileageLabel = formatMileageLabel(v.mileage)
  const calendarHref = buildCalendarTodayHref(v.vehicleDbId)
  const VehicleIcon = v.plateNumber.length > 8 ? Truck : Car

  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-2")}>
      {/* Row 1: plate + availability */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <VehicleIcon className="h-5 w-5 shrink-0 text-slate-400" />
          <span className={cn("font-bold text-slate-900 leading-tight", compact ? "text-sm" : "text-base")}>
            {v.plateNumber || "—"}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            v.available ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
          )}
        >
          {v.available ? "ว่าง" : "ไม่ว่าง"}
        </span>
      </div>

      {/* Row 2: GSM bar */}
      <GsmSignalBar gsm={v.gsm} indent={!compact} />

      {/* Row 3: speed + movement + battery + mileage */}
      <div className={cn("flex flex-wrap items-center gap-2 text-xs text-slate-600", !compact && "pl-7")}>
        <span className={cn("shrink-0 font-medium", v.speed > 90 && "font-bold text-red-600")}>
          {v.speed} km/h
        </span>
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold max-w-[160px] truncate",
            movement.className
          )}
          title={movement.label}
        >
          {movement.label}
        </span>
        {mileageLabel && (
          <span className="shrink-0 text-[11px] font-medium text-slate-700">
            ไมล์ {mileageLabel}
          </span>
        )}
        {batteryLabel && (
          <span className="shrink-0 text-[11px] text-slate-500">
            {batteryLabel}
          </span>
        )}
      </div>

      {/* Row 4: address */}
      {v.address && (
        <div className={cn("flex items-start gap-1.5 text-xs text-slate-600", !compact && "pl-7")}>
          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
          <span className="line-clamp-2 leading-relaxed">{v.address}</span>
        </div>
      )}

      {/* Row 5: near */}
      {v.near && (
        <div className={cn("text-xs text-slate-500", !compact && "pl-7")}>
          อยู่ที่ {v.near}
        </div>
      )}

      {/* Row 6: today jobs box */}
      <div className={cn(!compact && "pl-7")}>
        {calendarHref ? (
          <Link
            href={calendarHref}
            onClick={onJobLinkClick}
            className="block rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 transition-colors hover:border-cyan-200 hover:bg-cyan-50/40"
          >
            <div className="text-[11px] font-semibold text-slate-600">ใบงานภายในวัน</div>
            <div className="text-xs font-semibold text-cyan-700">
              {v.todayJobCount > 0 ? `${v.todayJobCount} ใบงาน` : "ไม่มีใบงานวันนี้"}
            </div>
          </Link>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
            <div className="text-[11px] font-semibold text-slate-600">ใบงานภายในวัน</div>
            <div className="text-xs text-slate-400">
              {v.vehicleDbId
                ? v.todayJobCount > 0
                  ? `${v.todayJobCount} ใบงาน`
                  : "ไม่มีใบงานวันนี้"
                : "—"}
            </div>
          </div>
        )}
      </div>

      {/* Active job link when busy */}
      {!v.available && v.activeJob && (
        <div className={cn(!compact && "pl-7")}>
          <Link
            href={`/transport/jobs/${v.activeJob.jobId}`}
            onClick={onJobLinkClick}
            className="text-[11px] font-semibold text-blue-600 hover:underline"
          >
            งานปัจจุบัน: {v.activeJob.jobNumber}
            {v.activeJob.jobType ? ` · ${v.activeJob.jobType}` : ""}
          </Link>
        </div>
      )}

      {/* Row 7: last update */}
      {v.lastUpdate && (
        <div className={cn("flex items-center gap-1 text-[10px] text-slate-400", !compact && "pl-7")}>
          <Clock className="h-3 w-3 shrink-0" />
          อัปเดตล่าสุด: {v.lastUpdate}
        </div>
      )}

      {/* Row 8: alerts */}
      {showAlerts && hasAnyAlert(v.alerts) && (
        <div className={cn(!compact && "pl-7")}>
          <GpsAlertBadge alerts={v.alerts} compact />
        </div>
      )}
    </div>
  )
}
