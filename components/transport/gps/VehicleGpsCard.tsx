"use client"

import Link from "next/link"
import { Briefcase, Car, Truck, MapPin, Clock, View } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { googleStreetViewUrl } from "@/shared/transport/coordinates"
import { GpsAlertBadge, hasAnyAlert } from "./GpsAlertBadge"
import { GsmSignalBar } from "./GsmSignalBar"
import {
  buildCalendarTodayHref,
  formatBatteryLabel,
  formatMileageLabel,
  getMovementStatus,
} from "./gps-display-utils"
import { getAvailabilityLabel } from "./availability-label"

type Props = {
  vehicle: GpsVehicleData
  compact?: boolean
  batteryShort?: boolean
  showAlerts?: boolean
  onJobLinkClick?: (e: React.MouseEvent) => void
}

function todayJobsTone(count: number, hasDbId: boolean): "none" | "has" | "empty" {
  if (!hasDbId) return "none"
  return count > 0 ? "has" : "empty"
}

const TODAY_JOBS_PILL: Record<"none" | "has" | "empty", string> = {
  has: "border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200",
  empty:
    "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100",
  none: "border-border bg-muted text-muted-foreground",
}

const TODAY_JOBS_VALUE: Record<"none" | "has" | "empty", string> = {
  has: "text-cyan-800 dark:text-cyan-200",
  empty: "text-amber-900 dark:text-amber-100",
  none: "text-muted-foreground",
}

export function VehicleGpsCard({ vehicle: v, compact = false, batteryShort = false, showAlerts = true, onJobLinkClick }: Props) {
  const movement = getMovementStatus(v)
  const batteryLabel = formatBatteryLabel(v.battery, { short: batteryShort })
  const mileageLabel = formatMileageLabel(v.mileage)
  const calendarHref = buildCalendarTodayHref(v.vehicleDbId)
  const VehicleIcon = v.plateNumber.length > 8 ? Truck : Car
  const avail = getAvailabilityLabel(v)
  const tone = todayJobsTone(v.todayJobCount, Boolean(v.vehicleDbId))
  const todayJobsLabel =
    tone === "none"
      ? "—"
      : tone === "has"
        ? `${v.todayJobCount} ใบงานวันนี้`
        : "ไม่มีใบงานวันนี้"
  const todayJobsShortLabel =
    tone === "none"
      ? "—"
      : tone === "has"
        ? `${v.todayJobCount} ใบงาน`
        : "ไม่มีใบงานวันนี้"

  const pillClass = cn(
    "inline-flex w-fit max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
    TODAY_JOBS_PILL[tone]
  )

  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-2")}>
      {/* Row 1: plate + availability */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <VehicleIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className={cn("font-bold leading-tight text-foreground", compact ? "text-sm" : "text-base")}>
            {v.plateNumber || "—"}
          </span>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", avail.className)}>
          {avail.label}
        </span>
      </div>

      {/* Row 2: GSM bar */}
      <GsmSignalBar gsm={v.gsm} indent={!compact} />

      {/* Row 3: speed + movement + battery + mileage */}
      <div className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", !compact && "pl-7")}>
        <span className={cn("shrink-0 font-medium", v.speed > 90 && "font-bold text-red-600 dark:text-red-400")}>
          {v.speed} km/h
        </span>
        <span
          className={cn(
            "max-w-[160px] shrink-0 truncate rounded-md px-2 py-0.5 text-[10px] font-semibold",
            movement.className
          )}
          title={movement.label}
        >
          {movement.label}
        </span>
        {mileageLabel && (
          <span className="shrink-0 text-[11px] font-medium text-foreground">
            ไมล์ {mileageLabel}
          </span>
        )}
        {batteryLabel && (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {batteryLabel}
          </span>
        )}
      </div>

      {/* Compact: today jobs status */}
      {compact && (
        <div className="flex flex-wrap items-center gap-2">
          {calendarHref ? (
            <Link
              href={calendarHref}
              onClick={onJobLinkClick}
              className={cn(pillClass, "hover:opacity-90")}
            >
              <Briefcase className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{todayJobsLabel}</span>
            </Link>
          ) : (
            <span className={pillClass}>
              <Briefcase className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{todayJobsLabel}</span>
            </span>
          )}
          {!v.available && v.activeJob && (
            <Link
              href={`/transport/jobs/${v.activeJob.jobId}`}
              onClick={onJobLinkClick}
              className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {v.activeJob.jobNumber}
            </Link>
          )}
        </div>
      )}

      {!compact && (
        <>
          {/* Row 4: address */}
          {v.address && (
            <div className="flex items-start gap-1.5 pl-7 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2 leading-relaxed">{v.address}</span>
            </div>
          )}

          {/* Row 5: near */}
          {v.near && (
            <div className="pl-7 text-xs text-muted-foreground">
              อยู่ที่ {v.near}
            </div>
          )}

          {/* Street View */}
          {!!v.lat && !!v.lng && (
            <div className="pl-7">
              <a
                href={googleStreetViewUrl(v.lat, v.lng)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-950/60"
              >
                <View className="h-3 w-3" />
                Street View
              </a>
            </div>
          )}

          {/* Row 6: today jobs box */}
          <div className="pl-7">
            {calendarHref ? (
              <Link
                href={calendarHref}
                onClick={onJobLinkClick}
                className={cn(
                  "block rounded-lg border px-3 py-2 transition-colors",
                  tone === "has" &&
                    "border-cyan-300 bg-cyan-50 hover:bg-cyan-100/80 dark:border-cyan-700 dark:bg-cyan-950/40 dark:hover:bg-cyan-950/60",
                  tone === "empty" &&
                    "border-amber-300 bg-amber-50 hover:bg-amber-100/80 dark:border-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-950/60",
                  tone === "none" && "border-border bg-muted/50 hover:bg-muted"
                )}
              >
                <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                  <Briefcase className="h-3 w-3" aria-hidden />
                  ใบงานภายในวัน
                </div>
                <div className={cn("text-[11px] font-semibold", TODAY_JOBS_VALUE[tone])}>
                  {todayJobsShortLabel}
                </div>
              </Link>
            ) : (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2",
                  tone === "has" && "border-cyan-300 bg-cyan-50 dark:border-cyan-700 dark:bg-cyan-950/40",
                  tone === "empty" && "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40",
                  tone === "none" && "border-border bg-muted/50"
                )}
              >
                <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                  <Briefcase className="h-3 w-3" aria-hidden />
                  ใบงานภายในวัน
                </div>
                <div className={cn("text-[11px] font-semibold", TODAY_JOBS_VALUE[tone])}>
                  {todayJobsShortLabel}
                </div>
              </div>
            )}
          </div>

          {/* Active job link when busy */}
          {!v.available && v.activeJob && (
            <div className="pl-7">
              <Link
                href={`/transport/jobs/${v.activeJob.jobId}`}
                onClick={onJobLinkClick}
                className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                งานปัจจุบัน: {v.activeJob.jobNumber}
                {v.activeJob.jobType ? ` · ${v.activeJob.jobType}` : ""}
              </Link>
            </div>
          )}

          {/* Row 7: last update */}
          {v.lastUpdate && (
            <div className="flex items-center gap-1 pl-7 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              อัปเดตล่าสุด: {v.lastUpdate}
            </div>
          )}
        </>
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
