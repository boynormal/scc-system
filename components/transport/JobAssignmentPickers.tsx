"use client"

import { useState, useEffect, useCallback } from "react"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { GpsLinkWarning } from "@/components/transport/GpsLinkWarning"

export type AssignmentVehicle = {
  id: string
  plateNumber: string
  name: string
  vehicleType: string
  gpsDeviceId?: string | null
  branch?: { name: string }
}

export type AssignmentDriver = {
  id: string
  firstName: string
  lastName: string
  code: string
  phone?: string | null
  assignedVehicleId?: string | null
  branch?: { name: string }
}

type Props = {
  branchId: string
  vehicleId: string
  driverId: string
  onVehicleChange: (id: string) => void
  onDriverChange: (id: string) => void
  /** Extra vehicles to include (e.g. current assignment when on_job) */
  extraVehicles?: AssignmentVehicle[]
  extraDrivers?: AssignmentDriver[]
  vehicleLabel?: string
  driverLabel?: string
  /** โหลดรถทั้งหมดของบริษัท (ไม่กรองตามสาขา) — ใช้เมื่อรถใช้งานร่วมกันได้ */
  vehiclesScope?: "branch" | "all"
  /** โหลดคนขับทั้งหมดของบริษัท (ไม่กรองตามสาขา) */
  driversScope?: "branch" | "all"
  vehicleRequired?: boolean
  driverRequired?: boolean
}

export function JobAssignmentPickers({
  branchId,
  vehicleId,
  driverId,
  onVehicleChange,
  onDriverChange,
  extraVehicles = [],
  extraDrivers = [],
  vehicleLabel = "รถ",
  driverLabel = "คนขับ",
  vehiclesScope = "branch",
  driversScope = "branch",
  vehicleRequired = false,
  driverRequired = false,
}: Props) {
  const [vehicles, setVehicles] = useState<AssignmentVehicle[]>([])
  const [drivers, setDrivers] = useState<AssignmentDriver[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchOptions = useCallback(async () => {
    try {
      const vehicleUrl =
        vehiclesScope === "all"
          ? "/api/transport/vehicles"
          : branchId
            ? `/api/transport/vehicles?branchId=${branchId}`
            : null

      const driverUrl =
        driversScope === "all"
          ? "/api/transport/drivers"
          : branchId
            ? `/api/transport/drivers?branchId=${branchId}`
            : null

      const [vJson, dJson] = await Promise.all([
        vehicleUrl ? fetch(vehicleUrl).then((r) => r.json()) : Promise.resolve({ data: [] }),
        driverUrl ? fetch(driverUrl).then((r) => r.json()) : Promise.resolve({ data: [] }),
      ])

      setVehicles(vJson.data ?? [])
      setDrivers(dJson.data ?? [])
      setLoadError(null)
    } catch {
      setLoadError("โหลดรายการรถ/คนขับไม่ได้")
    }
  }, [branchId, vehiclesScope, driversScope])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  const mergedVehicles = (() => {
    const map = new Map<string, AssignmentVehicle>()
    for (const v of [...extraVehicles, ...vehicles]) map.set(v.id, v)
    return [...map.values()].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))
  })()

  const mergedDrivers = (() => {
    const map = new Map<string, AssignmentDriver>()
    for (const d of [...extraDrivers, ...drivers]) map.set(d.id, d)
    return [...map.values()].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    )
  })()

  const selectedVehicle = mergedVehicles.find((v) => v.id === vehicleId)

  const handleVehicleChange = (id: string) => {
    onVehicleChange(id)
    if (!id) {
      onDriverChange("")
      return
    }
    const linked = mergedDrivers.filter((d) => d.assignedVehicleId === id)
    if (linked.length === 1) {
      onDriverChange(linked[0].id)
    } else if (!linked.some((d) => d.id === driverId)) {
      onDriverChange("")
    }
  }

  return (
    <div className="space-y-3">
      {loadError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {loadError}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {vehicleLabel}
          {vehicleRequired && " *"}
        </label>
        <select
          value={vehicleId}
          onChange={(e) => handleVehicleChange(e.target.value)}
          required={vehicleRequired}
          disabled={vehiclesScope === "branch" && !branchId}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500",
            !vehicleId ? "border-slate-300" : "border-cyan-400"
          )}
        >
          <option value="">-- เลือกรถ --</option>
          {mergedVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {!v.gpsDeviceId ? "⚠ " : ""}
              {v.plateNumber} — {v.name}
              {vehiclesScope === "all" && v.branch?.name ? ` [${v.branch.name}]` : ""}
              {" "}({v.vehicleType})
            </option>
          ))}
        </select>
      </div>

      {selectedVehicle && (
        <GpsLinkWarning
          gpsDeviceId={selectedVehicle.gpsDeviceId}
          plateNumber={selectedVehicle.plateNumber}
          compact
        />
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {driverLabel}
          {driverRequired && " *"}
        </label>
        <select
          value={driverId}
          onChange={(e) => onDriverChange(e.target.value)}
          required={driverRequired}
          disabled={driversScope === "branch" && !branchId}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500",
            !driverId ? "border-slate-300" : "border-cyan-400"
          )}
        >
          <option value="">-- เลือกคนขับ --</option>
          {mergedDrivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.firstName} {d.lastName} ({d.code})
              {driversScope === "all" && d.branch?.name ? ` [${d.branch.name}]` : ""}
            </option>
          ))}
        </select>
        {vehicleId && mergedDrivers.filter((d) => d.assignedVehicleId === vehicleId).length === 0 && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            ไม่มีคนขับผูกกับรถคันนี้ — เลือกคนขับด้วยตนเอง
          </p>
        )}
      </div>
    </div>
  )
}
