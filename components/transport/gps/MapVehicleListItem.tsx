"use client"

import { cn } from "@/lib/utils"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { hasAnyAlert } from "./GpsAlertBadge"
import { VehicleGpsCard } from "./VehicleGpsCard"

type Props = {
  vehicle: GpsVehicleData
  selected?: boolean
  /** When true, show compact summary unless this row is selected (auto-expands). */
  compact?: boolean
  onClick?: () => void
}

export function MapVehicleListItem({ vehicle: v, selected, compact = false, onClick }: Props) {
  const hasAlert = hasAnyAlert(v.alerts)
  const showCompact = compact && !selected

  return (
    <li
      onClick={onClick}
      className={cn(
        "cursor-pointer border-b border-border px-4 py-3 transition-colors",
        selected && "border-l-4 border-l-cyan-500 bg-cyan-50 dark:bg-cyan-950/40",
        hasAlert && !selected && "bg-red-50/40 dark:bg-red-950/30",
        !selected && !hasAlert && "hover:bg-muted/60"
      )}
    >
      <VehicleGpsCard
        vehicle={v}
        compact={showCompact}
        batteryShort
        onJobLinkClick={(e) => e.stopPropagation()}
      />
    </li>
  )
}
