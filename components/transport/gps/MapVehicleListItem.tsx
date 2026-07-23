"use client"

import { cn } from "@/lib/utils"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { hasAnyAlert } from "./GpsAlertBadge"
import { VehicleGpsCard } from "./VehicleGpsCard"

type Props = {
  vehicle: GpsVehicleData
  selected?: boolean
  onClick?: () => void
}

export function MapVehicleListItem({ vehicle: v, selected, onClick }: Props) {
  const hasAlert = hasAnyAlert(v.alerts)

  return (
    <li
      onClick={onClick}
      className={cn(
        "cursor-pointer border-b border-slate-100 px-4 py-3 transition-colors",
        selected && "bg-cyan-50 border-l-4 border-l-cyan-500",
        hasAlert && !selected && "bg-red-50/40",
        !selected && !hasAlert && "hover:bg-slate-50"
      )}
    >
      <VehicleGpsCard
        vehicle={v}
        batteryShort
        onJobLinkClick={(e) => e.stopPropagation()}
      />
    </li>
  )
}
