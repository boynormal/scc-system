import type { GpsVehicleData } from "@/app/api/transport/gps/route"

export type UnmatchedGpsOption = {
  id: string
  plateNumber: string
  imei: string
}

export type MasterVehicleOption = {
  id: string
  plateNumber: string
  name: string
  branchId: string
  gpsDeviceId?: string | null
}

const normPlate = (p: string) => p.toUpperCase().replace(/\s+/g, "")

export function filterUnmatchedGps(vehicles: GpsVehicleData[]): UnmatchedGpsOption[] {
  return vehicles
    .filter((v) => !v.matchedInDb && v.imei?.trim())
    .map((v) => ({
      id: v.id,
      plateNumber: v.plateNumber || "—",
      imei: v.imei.trim(),
    }))
    .sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))
}

/** GPS devices whose IMEI is not yet assigned to any master vehicle (includes plate-matched but unlinked). */
export function filterLinkableGps(
  gpsVehicles: GpsVehicleData[],
  masterVehicles: MasterVehicleOption[]
): UnmatchedGpsOption[] {
  const linkedImeis = new Set(
    masterVehicles.flatMap((v) => {
      const imei = v.gpsDeviceId?.trim()
      return imei ? [imei] : []
    })
  )

  return gpsVehicles
    .filter((v) => {
      const imei = v.imei?.trim()
      return imei && !linkedImeis.has(imei)
    })
    .map((v) => ({
      id: v.id,
      plateNumber: v.plateNumber || "—",
      imei: v.imei.trim(),
    }))
    .sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))
}

export function filterUnlinkedMasterVehicles(
  vehicles: MasterVehicleOption[]
): MasterVehicleOption[] {
  return vehicles
    .filter((v) => !v.gpsDeviceId?.trim())
    .sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))
}

export function platesMismatch(gpsPlate: string, masterPlate: string): boolean {
  if (!gpsPlate || !masterPlate || gpsPlate === "—") return false
  return normPlate(gpsPlate) !== normPlate(masterPlate)
}

export async function fetchGpsVehicles(): Promise<GpsVehicleData[]> {
  const res = await fetch("/api/transport/gps")
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error ?? "ไม่สามารถโหลดข้อมูล GPS ได้")
  }
  return json.data ?? []
}

export async function linkGpsToVehicle(vehicleId: string, imei: string): Promise<void> {
  const res = await fetch(`/api/transport/vehicles/${vehicleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gpsDeviceId: imei.trim() }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(parseApiError(json))
  }
}

export type CreateVehicleWithGpsInput = {
  branchId: string
  plateNumber: string
  name: string
  vehicleType: string
  gpsDeviceId: string
  maxWeightKg?: number
}

export async function createVehicleWithGps(input: CreateVehicleWithGpsInput): Promise<void> {
  const res = await fetch("/api/transport/vehicles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branchId: input.branchId,
      plateNumber: input.plateNumber.trim(),
      name: input.name.trim(),
      vehicleType: input.vehicleType,
      gpsDeviceId: input.gpsDeviceId.trim(),
      ...(input.maxWeightKg != null ? { maxWeightKg: input.maxWeightKg } : {}),
    }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(parseApiError(json))
  }
}

function parseApiError(json: { error?: unknown }): string {
  if (typeof json.error === "string") return json.error
  if (json.error && typeof json.error === "object" && "message" in json.error) {
    return String((json.error as { message: string }).message)
  }
  return "เกิดข้อผิดพลาด"
}
