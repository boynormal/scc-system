import type { PrismaClient } from "@prisma/client"
import { getBangkokTodayRange } from "./transport-date-utils"

export type ActiveJobInfo = {
  jobId: string
  jobNumber: string
  status: string
  customerName: string | null
  jobType: string
  driverName: string | null
}

export type GpsVehicleData = {
  id: string
  imei: string
  asset: string
  plateNumber: string
  lat: number
  lng: number
  rotation: number
  speed: number
  engineOn: boolean
  online: boolean
  status: string
  driverName: string
  address: string
  near: string
  lastUpdate: string
  battery: string
  sat: string
  gsm: string
  mileage: string
  alerts: {
    overSpeed: boolean
    offRoute: boolean
    overPark: boolean
    overEngine: boolean
    checkZone: boolean
  }
  available: boolean
  activeJob: ActiveJobInfo | null
  vehicleDbId: string | null
  matchedInDb: boolean
  todayJobCount: number
}

function boolAlert(val: unknown): boolean {
  if (typeof val === "boolean") return val
  if (typeof val === "string") return val === "1" || val.toLowerCase() === "true"
  if (typeof val === "number") return val === 1
  return false
}

const IN_PROGRESS_STATUSES = [
  "driver_accepted",
  "en_route",
  "at_pickup",
  "loading",
  "departed",
  "at_destination",
  "unloading",
] as const

type ActiveJobMaps = {
  imeiMap: Map<string, ActiveJobInfo>
  plateMap: Map<string, ActiveJobInfo>
}

type VehicleLookupMaps = {
  imeiToId: Map<string, string>
  plateToId: Map<string, string>
}

type TodayJobCountMaps = {
  imeiMap: Map<string, number>
  plateMap: Map<string, number>
}

export type GpsLookupMaps = {
  activeMaps: ActiveJobMaps
  vehicleMaps: VehicleLookupMaps
  todayMaps: TodayJobCountMaps
}

const normPlate = (p: string) => p.toUpperCase().replace(/\s+/g, "")

async function fetchActiveAssignments(db: PrismaClient, companyId: string): Promise<ActiveJobMaps> {
  const { start, end } = getBangkokTodayRange()

  const activeJobs = await db.transportJob.findMany({
    where: {
      companyId,
      assignment: { isNot: null },
      OR: [
        { status: { in: [...IN_PROGRESS_STATUSES] } },
        { status: "assigned", scheduledDate: { gte: start, lte: end } },
        { status: "assigned", scheduledDate: null },
      ],
    },
    include: {
      assignment: {
        include: {
          vehicle: { select: { plateNumber: true, gpsDeviceId: true } },
          driver: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  const imeiMap = new Map<string, ActiveJobInfo>()
  const plateMap = new Map<string, ActiveJobInfo>()

  for (const job of activeJobs) {
    if (!job.assignment) continue
    const driverName = `${job.assignment.driver.firstName} ${job.assignment.driver.lastName}`.trim()
    const info: ActiveJobInfo = {
      jobId: job.id,
      jobNumber: job.jobNumber,
      status: job.status,
      customerName: job.customerName,
      jobType: job.jobType,
      driverName,
    }
    if (job.assignment.vehicle.gpsDeviceId) {
      imeiMap.set(job.assignment.vehicle.gpsDeviceId.trim(), info)
    }
    plateMap.set(normPlate(job.assignment.vehicle.plateNumber), info)
  }

  return { imeiMap, plateMap }
}

async function fetchVehicleLookups(db: PrismaClient, companyId: string): Promise<VehicleLookupMaps> {
  const vehicles = await db.transportVehicle.findMany({
    where: { companyId, isActive: true },
    select: { id: true, plateNumber: true, gpsDeviceId: true },
  })

  const imeiToId = new Map<string, string>()
  const plateToId = new Map<string, string>()

  for (const v of vehicles) {
    plateToId.set(normPlate(v.plateNumber), v.id)
    if (v.gpsDeviceId) {
      imeiToId.set(v.gpsDeviceId.trim(), v.id)
    }
  }

  return { imeiToId, plateToId }
}

async function fetchTodayJobCounts(db: PrismaClient, companyId: string): Promise<TodayJobCountMaps> {
  const { start, end } = getBangkokTodayRange()

  const jobs = await db.transportJob.findMany({
    where: {
      companyId,
      scheduledDate: { gte: start, lte: end },
      assignment: { isNot: null },
    },
    include: {
      assignment: {
        include: {
          vehicle: { select: { plateNumber: true, gpsDeviceId: true } },
        },
      },
    },
  })

  const imeiMap = new Map<string, number>()
  const plateMap = new Map<string, number>()

  for (const job of jobs) {
    if (!job.assignment) continue
    const vehicle = job.assignment.vehicle
    if (vehicle.gpsDeviceId) {
      const key = vehicle.gpsDeviceId.trim()
      imeiMap.set(key, (imeiMap.get(key) ?? 0) + 1)
    }
    const plateKey = normPlate(vehicle.plateNumber)
    plateMap.set(plateKey, (plateMap.get(plateKey) ?? 0) + 1)
  }

  return { imeiMap, plateMap }
}

function resolveByImeiOrPlate<T>(
  imei: string,
  plate: string,
  imeiMap: Map<string, T>,
  plateMap: Map<string, T>,
  fallback: T
): T {
  if (imei && imeiMap.has(imei)) return imeiMap.get(imei)!
  if (plate && plateMap.has(plate)) return plateMap.get(plate)!
  return fallback
}

/** โหลด lookup maps ทั้งหมดที่ต้องใช้ normalize ข้อมูล GPS ต่อบริษัท (แต่ละ query ล้ม fallback เป็นค่าว่างแยกกัน) */
export async function fetchGpsLookupMaps(db: PrismaClient, companyId: string): Promise<GpsLookupMaps> {
  const emptyActive: ActiveJobMaps = { imeiMap: new Map(), plateMap: new Map() }
  const emptyVehicle: VehicleLookupMaps = { imeiToId: new Map(), plateToId: new Map() }
  const emptyToday: TodayJobCountMaps = { imeiMap: new Map(), plateMap: new Map() }

  const [activeMaps, vehicleMaps, todayMaps] = await Promise.all([
    fetchActiveAssignments(db, companyId).catch(() => emptyActive),
    fetchVehicleLookups(db, companyId).catch(() => emptyVehicle),
    fetchTodayJobCounts(db, companyId).catch(() => emptyToday),
  ])

  return { activeMaps, vehicleMaps, todayMaps }
}

/** แปลงข้อมูลดิบจาก GPS API ให้เป็น `GpsVehicleData[]` พร้อม match กับใบงาน/รถในระบบ */
export function normalizeGpsData(rawData: Record<string, unknown>[], maps: GpsLookupMaps): GpsVehicleData[] {
  const { activeMaps, vehicleMaps, todayMaps } = maps

  return rawData.map((car) => {
    const carImei = String(car.imei ?? "").trim()
    const carPlate = normPlate(String(car.number ?? ""))
    const activeJob = resolveByImeiOrPlate(
      carImei,
      carPlate,
      activeMaps.imeiMap,
      activeMaps.plateMap,
      null as ActiveJobInfo | null
    )
    const vehicleDbId = resolveByImeiOrPlate(
      carImei,
      carPlate,
      vehicleMaps.imeiToId,
      vehicleMaps.plateToId,
      null as string | null
    )
    const todayJobCount = resolveByImeiOrPlate(carImei, carPlate, todayMaps.imeiMap, todayMaps.plateMap, 0)

    return {
      id: String(car.id ?? ""),
      imei: String(car.imei ?? ""),
      asset: String(car.asset ?? ""),
      plateNumber: String(car.number ?? ""),
      lat: Number(car.lat ?? 0),
      lng: Number(car.lng ?? 0),
      rotation: Number(car.car_rotation ?? 0),
      speed: Number(car.speed ?? 0),
      engineOn: boolAlert(car.isEngineOn),
      online: String(car.statusonline ?? "").toLowerCase() === "online",
      status: String(car.status ?? ""),
      driverName: String(car.driver_name ?? ""),
      address: String(car.address ?? ""),
      near: String(car.near ?? ""),
      lastUpdate: String(car.datetime ?? car.lastUpdate ?? ""),
      battery: String(car.battery ?? ""),
      sat: String(car.sat ?? ""),
      gsm: String(car.gsm ?? ""),
      mileage: String(car.mileage ?? ""),
      alerts: {
        overSpeed: boolAlert(car.object_over_speed_alert),
        offRoute: boolAlert(car.object_off_route_alert),
        overPark: boolAlert(car.object_over_park_alert),
        overEngine: boolAlert(car.object_over_engine_alert),
        checkZone: boolAlert(car.object_check_zone),
      },
      available: activeJob === null,
      activeJob,
      vehicleDbId,
      matchedInDb: vehicleDbId !== null,
      todayJobCount,
    }
  })
}
