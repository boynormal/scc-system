import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { canTransportJobs, transportJobListBranchIds } from "./transport-job-access"
import { formatBangkokYmd, getBangkokDateRange } from "./transport-date-utils"
import {
  buildLegs,
  jobCheckReview,
  type PunchKind,
  type PunchLocation,
  type PunchStop,
} from "./job-punch-rules"

export const LICENSE_EXPIRING_DAYS = 30

export type LicenseReadiness = "ok" | "expiring" | "expired" | "missing"

export type DriverReportRow = {
  driverId: string
  name: string
  branchName: string
  vehiclePlate: string | null
  license: LicenseReadiness
  jobCount: number
  completedCount: number
  incompleteCheckins: number
  missingLocations: number
  completeCheckins: number
  totalKm: number
  unmeasuredJobs: number
  longDwells: number
  slowTravels: number
}

type ReportPunch = PunchLocation & {
  recordedAt: Date
  odometerKm: number | null
}

export type DriverReportJob = {
  status: string
  stops: PunchStop[]
  punches: ReportPunch[]
}

export type DriverReportInput = {
  id: string
  name: string
  branchName: string
  vehiclePlate: string | null
  licenseExpiry: Date | null
  jobs: DriverReportJob[]
}

function addDaysYmd(ymd: string, days: number) {
  const anchor = new Date(`${ymd}T12:00:00+07:00`)
  return formatBangkokYmd(new Date(anchor.getTime() + days * 24 * 60 * 60 * 1000))
}

/** Compare the expiry calendar day in Bangkok with today. */
export function licenseReadiness(expiry: Date | null, todayYmd: string): LicenseReadiness {
  if (!expiry) return "missing"
  const expiryYmd = formatBangkokYmd(expiry)
  if (expiryYmd < todayYmd) return "expired"
  if (expiryYmd <= addDaysYmd(todayYmd, LICENSE_EXPIRING_DAYS)) return "expiring"
  return "ok"
}

function tripKm(punches: ReportPunch[]): number | null {
  const start = punches.find((punch) => punch.kind === "start")
  const finish = punches.find((punch) => punch.kind === "finish")
  if (start?.odometerKm == null || finish?.odometerKm == null) return null
  return Math.round((finish.odometerKm - start.odometerKm) * 100) / 100
}

export function summarizeDriver(input: DriverReportInput, todayYmd: string): DriverReportRow {
  const row: DriverReportRow = {
    driverId: input.id,
    name: input.name,
    branchName: input.branchName,
    vehiclePlate: input.vehiclePlate,
    license: licenseReadiness(input.licenseExpiry, todayYmd),
    jobCount: input.jobs.length,
    completedCount: 0,
    incompleteCheckins: 0,
    missingLocations: 0,
    completeCheckins: 0,
    totalKm: 0,
    unmeasuredJobs: 0,
    longDwells: 0,
    slowTravels: 0,
  }

  for (const job of input.jobs) {
    if (job.status === "completed") row.completedCount += 1
    const review = jobCheckReview(job.stops, job.punches)
    if (review === "incomplete") row.incompleteCheckins += 1
    else if (review === "missing_location") row.missingLocations += 1
    else row.completeCheckins += 1

    const km = tripKm(job.punches)
    if (km == null) row.unmeasuredJobs += 1
    else row.totalKm = Math.round((row.totalKm + km) * 100) / 100

    for (const leg of buildLegs(job.punches)) {
      if (leg.flag === "long_dwell") row.longDwells += 1
      if (leg.flag === "slow_travel") row.slowTravels += 1
    }
  }

  return row
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const EMPTY_BRANCH = "00000000-0000-0000-0000-000000000000"

export async function listDriverMonitor(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId?: string | null; from: string; to: string }
) {
  if (!canTransportJobs(params.roles, "read")) throw new ForbiddenError()
  const limited = await transportJobListBranchIds(db, params.companyId, params.roles)
  if (params.branchId && limited && !limited.includes(params.branchId)) throw new ForbiddenError()

  const branchIds = params.branchId ? [params.branchId] : limited
  const branchFilter =
    branchIds == null
      ? {}
      : { branchId: { in: branchIds.length ? branchIds : [EMPTY_BRANCH] } }
  const range = getBangkokDateRange(params.from, params.to)
  const todayYmd = formatBangkokYmd()

  const [drivers, branches] = await Promise.all([
    db.driver.findMany({
      where: { companyId: params.companyId, isActive: true, ...branchFilter },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        licenseExpiry: true,
        branch: { select: { name: true } },
        assignedVehicle: { select: { plateNumber: true } },
        assignments: {
          where: {
            job: {
              companyId: params.companyId,
              scheduledDate: { gte: range.start, lte: range.end },
            },
          },
          select: {
            job: {
              select: {
                status: true,
                stops: { select: { id: true, sequence: true, status: true } },
                punches: {
                  select: {
                    stopId: true,
                    kind: true,
                    recordedAt: true,
                    odometerKm: true,
                    latitude: true,
                    longitude: true,
                    gpsLatitude: true,
                    gpsLongitude: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.branch.findMany({
      where: { companyId: params.companyId, isActive: true, ...branchFilter },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const rows = drivers
    .map((driver) =>
      summarizeDriver(
        {
          id: driver.id,
          name: `${driver.firstName} ${driver.lastName}`.trim(),
          branchName: driver.branch.name,
          vehiclePlate: driver.assignedVehicle?.plateNumber ?? null,
          licenseExpiry: driver.licenseExpiry,
          jobs: driver.assignments.map((assignment) => ({
            status: assignment.job.status,
            stops: assignment.job.stops,
            punches: assignment.job.punches.map((punch) => ({
              stopId: punch.stopId,
              kind: punch.kind as PunchKind,
              recordedAt: punch.recordedAt,
              odometerKm: decimalToNumber(punch.odometerKm),
              latitude: punch.latitude,
              longitude: punch.longitude,
              gpsLatitude: punch.gpsLatitude,
              gpsLongitude: punch.gpsLongitude,
            })),
          })),
        },
        todayYmd
      )
    )
    .sort(
      (a, b) => b.incompleteCheckins - a.incompleteCheckins || a.name.localeCompare(b.name, "th")
    )

  return { rows, branches }
}
