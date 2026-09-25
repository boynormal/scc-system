import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { fetchNormalizedGps, persistVehicleGpsSnapshots } from "./gps-service"
import {
  buildLegs,
  canGraceFillOdometer,
  canSkipStop,
  isFreshGps,
  nextPunch,
  parseOdometer,
  punchRecordedTooSoon,
  usesTripBookends,
  type PunchKind,
} from "./job-punch-rules"

function canReadJobs(roles: UserRole[], branchId: string) {
  return isAdminInAnyBranch(roles) || hasPermission(roles, branchId, "transport_jobs", "read")
}

async function findDriverAccount(
  db: PrismaClient,
  params: { companyId: string; userId: string }
) {
  return db.driver.findFirst({
    where: { userId: params.userId, companyId: params.companyId },
    select: { id: true },
  })
}

async function assertCanReadPunch(
  db: PrismaClient,
  job: { branchId: string },
  params: { companyId: string; userId: string; roles: UserRole[] }
) {
  if (canReadJobs(params.roles, job.branchId)) return
  const driverAccount = await findDriverAccount(db, params)
  if (!driverAccount) throw new ForbiddenError()
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function loadJob(db: PrismaClient, params: { id: string; companyId: string }) {
  const job = await db.transportJob.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: {
      stops: { orderBy: { sequence: "asc" } },
      punches: { orderBy: { recordedAt: "asc" } },
      assignment: {
        include: {
          driver: { select: { id: true, userId: true, firstName: true, lastName: true } },
          vehicle: {
            select: {
              id: true,
              plateNumber: true,
              gpsLatitude: true,
              gpsLongitude: true,
              gpsOdometerKm: true,
              gpsReadAt: true,
            },
          },
        },
      },
    },
  })
  if (!job) throw new NotFoundError("Job not found")
  return job
}

function toView(job: Awaited<ReturnType<typeof loadJob>>) {
  const punches = job.punches.map((punch) => ({
    id: punch.id,
    stopId: punch.stopId,
    kind: punch.kind as PunchKind,
    recordedAt: punch.recordedAt,
    odometerKm: decimalToNumber(punch.odometerKm),
    latitude: decimalToNumber(punch.latitude),
    longitude: decimalToNumber(punch.longitude),
    gpsLatitude: decimalToNumber(punch.gpsLatitude),
    gpsLongitude: decimalToNumber(punch.gpsLongitude),
  }))
  const stops = job.stops.map((stop) => ({
    id: stop.id,
    sequence: stop.sequence,
    status: stop.status,
    customerName: stop.customerName,
    address: stop.address,
    latitude: decimalToNumber(stop.latitude),
    longitude: decimalToNumber(stop.longitude),
  }))
  return {
    jobId: job.id,
    jobNumber: job.jobNumber,
    status: job.status,
    branchId: job.branchId,
    driverUserId: job.assignment?.driver.userId ?? null,
    stops,
    punches,
    next: nextPunch(stops, punches),
    legs: buildLegs(punches),
    canSkipStopId:
      job.assignment && nextPunch(stops, punches)
        ? stops.find((stop) => canSkipStop(stops, stop.id, punches))?.id ?? null
        : null,
  }
}

export async function getJobPunchView(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[]; userId: string }
) {
  const job = await loadJob(db, params)
  await assertCanReadPunch(db, job, params)
  return toView(job)
}

async function snapshotForVehicle(
  db: PrismaClient,
  params: { companyId: string; vehicleId: string; now: Date }
) {
  const vehicle = await db.transportVehicle.findFirst({
    where: { id: params.vehicleId, companyId: params.companyId },
    select: { gpsLatitude: true, gpsLongitude: true, gpsOdometerKm: true, gpsReadAt: true },
  })
  if (!vehicle || !isFreshGps(vehicle.gpsReadAt, params.now)) return null
  return {
    gpsLatitude: decimalToNumber(vehicle.gpsLatitude),
    gpsLongitude: decimalToNumber(vehicle.gpsLongitude),
    odometerKm: decimalToNumber(vehicle.gpsOdometerKm),
    gpsReadAt: vehicle.gpsReadAt,
  }
}

async function ensureFreshSnapshot(
  db: PrismaClient,
  params: { companyId: string; vehicleId: string; now: Date }
) {
  const cached = await snapshotForVehicle(db, params)
  if (cached) return cached
  try {
    const vehicles = await fetchNormalizedGps(db, params.companyId)
    if (vehicles.length > 0) {
      await persistVehicleGpsSnapshots(db, vehicles, params.now)
      await graceFillPunchOdometers(db, params.companyId, vehicles, params.now)
    }
  } catch (error) {
    console.error("[job-punch] GPS snapshot unavailable", error)
  }
  return snapshotForVehicle(db, params)
}

async function assertCanPunch(
  db: PrismaClient,
  job: Awaited<ReturnType<typeof loadJob>>,
  params: { companyId: string; userId: string }
) {
  if (job.status === "pending_review") {
    throw new ValidationError("ใบงานรอตรวจสอบแล้ว บันทึกเพิ่มไม่ได้")
  }
  if (job.status === "completed" || job.status === "cancelled") {
    throw new ValidationError("ใบงานนี้ปิดแล้ว")
  }
  if (!job.assignment) throw new ValidationError("ใบงานนี้ยังไม่มอบหมายรถ")
  const driverAccount = await findDriverAccount(db, params)
  if (!driverAccount) throw new ForbiddenError("บันทึกได้เฉพาะบัญชีคนขับ")
}

export async function recordJobPunch(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    userId: string
    roles: UserRole[]
    stopId?: string | null
    kind: PunchKind
    latitude?: number | null
    longitude?: number | null
    now?: Date
  }
) {
  const now = params.now ?? new Date()
  const job = await loadJob(db, params)
  await assertCanReadPunch(db, job, params)
  await assertCanPunch(db, job, params)

  const bookend = params.kind === "start" || params.kind === "finish"
  const stopId = bookend ? null : params.stopId ?? null
  if (!bookend && !stopId) throw new ValidationError("ข้อมูลบันทึกไม่ถูกต้อง")

  const view = toView(job)
  if (!view.next || view.next.stopId !== stopId || view.next.kind !== params.kind) {
    throw new ValidationError("ยังไม่ถึงจังหวะนี้")
  }
  const previous = job.punches.at(-1)
  if (previous && punchRecordedTooSoon(previous.recordedAt, now)) {
    throw new ValidationError("เพิ่งบันทึกไปเมื่อสักครู่ รอสักครู่แล้วกดจังหวะถัดไป")
  }

  const vehicleId = job.assignment!.vehicleId
  const snapshot = await ensureFreshSnapshot(db, { companyId: params.companyId, vehicleId, now })
  const bookends = usesTripBookends(view.punches)
  const active = view.stops.filter((stop) => stop.status !== "skipped" && stop.status !== "cancelled")
  const stopIndex = stopId ? active.findIndex((stop) => stop.id === stopId) : -1
  const isLegacyFirstDepart = !bookends && params.kind === "depart" && stopIndex === 0
  const isLegacyLastArrive = !bookends && params.kind === "arrive" && stopIndex === active.length - 1
  const opensTrip = params.kind === "start" || isLegacyFirstDepart
  const closesTrip = params.kind === "finish" || isLegacyLastArrive

  await db.$transaction(async (tx) => {
    await tx.jobStopPunch.create({
      data: {
        jobId: job.id,
        stopId,
        kind: params.kind,
        recordedAt: now,
        recordedBy: params.userId,
        latitude: params.latitude ?? null,
        longitude: params.longitude ?? null,
        gpsLatitude: snapshot?.gpsLatitude ?? null,
        gpsLongitude: snapshot?.gpsLongitude ?? null,
        odometerKm: snapshot?.odometerKm ?? null,
        gpsReadAt: snapshot?.gpsReadAt ?? null,
      },
    })

    if (params.kind === "arrive" && stopId) {
      await tx.jobStop.update({
        where: { id: stopId },
        data: {
          status: isLegacyLastArrive ? "completed" : "arrived",
          actualArrival: now,
        },
      })
    } else if (params.kind === "depart" && stopId) {
      await tx.jobStop.update({
        where: { id: stopId },
        data: { status: "completed" },
      })
    }

    if (opensTrip && (job.status === "assigned" || job.status === "driver_accepted")) {
      await tx.transportJob.update({ where: { id: job.id }, data: { status: "en_route" } })
      await tx.jobAssignment.update({
        where: { jobId: job.id },
        data: { startTime: job.assignment?.startTime ?? now },
      })
    }

    if (closesTrip) {
      await tx.transportJob.update({ where: { id: job.id }, data: { status: "pending_review" } })
      await tx.jobAssignment.update({
        where: { jobId: job.id },
        data: { endTime: now },
      })
    }
  })

  return getJobPunchView(db, params)
}

export async function skipJobStop(
  db: PrismaClient,
  params: { id: string; companyId: string; userId: string; roles: UserRole[]; stopId: string }
) {
  const job = await loadJob(db, params)
  await assertCanReadPunch(db, job, params)
  await assertCanPunch(db, job, params)
  const view = toView(job)
  if (!canSkipStop(view.stops, params.stopId, view.punches)) {
    throw new ValidationError("ข้ามได้เฉพาะจุดกลางที่ยังไม่บันทึก")
  }
  await db.jobStop.update({ where: { id: params.stopId }, data: { status: "skipped" } })
  return getJobPunchView(db, params)
}

export async function graceFillPunchOdometers(
  db: PrismaClient,
  companyId: string,
  vehicles: { vehicleDbId: string | null; lat: number; lng: number; mileage: string }[],
  readAt: Date
) {
  for (const vehicle of vehicles) {
    if (!vehicle.vehicleDbId) continue
    const odometer = parseOdometer(vehicle.mileage)
    if (odometer == null) continue
    const punches = await db.jobStopPunch.findMany({
      where: {
        odometerKm: null,
        job: { companyId, assignment: { vehicleId: vehicle.vehicleDbId } },
      },
      select: { id: true, recordedAt: true },
    })
    const ids = punches
      .filter((punch) => canGraceFillOdometer(punch.recordedAt, readAt))
      .map((punch) => punch.id)
    if (ids.length === 0) continue
    await db.jobStopPunch.updateMany({
      where: { id: { in: ids }, odometerKm: null },
      data: {
        odometerKm: odometer,
        gpsLatitude: vehicle.lat,
        gpsLongitude: vehicle.lng,
        gpsReadAt: readAt,
      },
    })
  }
}
