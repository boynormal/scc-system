"use client"

import dynamic from "next/dynamic"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"

const LeafletMapInner = dynamic(() => import("./LeafletMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
      กำลังโหลดแผนที่...
    </div>
  ),
})

type Props = {
  vehicles: GpsVehicleData[]
  selectedId?: string | null
  onSelectVehicle?: (id: string) => void
  height?: string
}

export function TransportMap({ vehicles, selectedId, onSelectVehicle, height = "100%" }: Props) {
  return (
    <LeafletMapInner
      vehicles={vehicles}
      selectedId={selectedId}
      onSelectVehicle={onSelectVehicle}
      height={height}
    />
  )
}
