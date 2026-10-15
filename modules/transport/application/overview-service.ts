import type { PrismaClient, TransportJobStatus } from "@prisma/client"
import { ACTIVE_JOB_STATUSES } from "@/shared/transport/job-status-groups"
import { getBangkokTodayRange } from "./transport-date-utils"

const IN_PROGRESS_STATUSES = ACTIVE_JOB_STATUSES.filter(
  (s): s is Exclude<TransportJobStatus, "pending_assignment"> => s !== "pending_assignment"
)

export type TransportOverview = Awaited<ReturnType<typeof getTransportOverview>>

/**
 * Operational snapshot for `/transport`.
 * Fleet (vehicles/drivers) = company-wide; jobs/repairs = provided branchIds.
 */
export async function getTransportOverview(
  db: PrismaClient,
  params: { companyId: string; branchIds: string[] }
) {
  const { companyId, branchIds } = params
  const { start: todayStart, end: todayEnd } = getBangkokTodayRange()
  const jobBranch =
    branchIds.length > 0 ? { companyId, branchId: { in: branchIds } } : { companyId, branchId: { in: [] as string[] } }
  const fleetWhere = { companyId, isActive: true }

  const [
    vehiclesAvailable,
    vehiclesOnJob,
    vehiclesMaintenance,
    driversAvailable,
    pendingAssignment,
    jobsInProgress,
    scheduledToday,
    completedToday,
    cancelledToday,
    repairsReported,
    repairsInRepair,
    pendingJobs,
    openRepairs,
    recentJobs,
  ] = await Promise.all([
    db.transportVehicle.count({ where: { ...fleetWhere, currentStatus: "available" } }),
    db.transportVehicle.count({ where: { ...fleetWhere, currentStatus: "on_job" } }),
    db.transportVehicle.count({ where: { ...fleetWhere, currentStatus: "maintenance" } }),
    db.driver.count({ where: { ...fleetWhere, currentStatus: "available" } }),
    db.transportJob.count({ where: { ...jobBranch, status: "pending_assignment" } }),
    db.transportJob.count({ where: { ...jobBranch, status: { in: IN_PROGRESS_STATUSES } } }),
    db.transportJob.count({
      where: {
        ...jobBranch,
        scheduledDate: { gte: todayStart, lte: todayEnd },
        status: { notIn: ["completed", "cancelled"] },
      },
    }),
    db.transportJob.count({
      where: {
        ...jobBranch,
        status: "completed",
        updatedAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    db.transportJob.count({
      where: {
        ...jobBranch,
        status: "cancelled",
        updatedAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    db.transportRepairLog.count({ where: { ...jobBranch, status: "reported" } }),
    db.transportRepairLog.count({ where: { ...jobBranch, status: "in_repair" } }),
    db.transportJob.findMany({
      where: { ...jobBranch, status: "pending_assignment" },
      select: {
        id: true,
        jobNumber: true,
        customerName: true,
        priority: true,
        scheduledDate: true,
        createdAt: true,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    db.transportRepairLog.findMany({
      where: { ...jobBranch, status: { in: ["reported", "in_repair"] } },
      select: {
        id: true,
        symptom: true,
        status: true,
        reportedAt: true,
        vehicle: { select: { plateNumber: true, name: true } },
      },
      orderBy: { reportedAt: "desc" },
      take: 5,
    }),
    db.transportJob.findMany({
      where: { ...jobBranch, status: { in: ACTIVE_JOB_STATUSES } },
      include: {
        assignment: {
          include: {
            vehicle: { select: { plateNumber: true } },
            driver: { select: { firstName: true, lastName: true } },
          },
        },
        _count: { select: { stops: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ])

  const openRepairsTotal = repairsReported + repairsInRepair

  return {
    attention: {
      pendingAssignment,
      scheduledToday,
      openRepairs: openRepairsTotal,
      vehiclesMaintenance,
    },
    fleet: {
      vehiclesAvailable,
      vehiclesOnJob,
      vehiclesMaintenance,
      driversAvailable,
    },
    today: {
      jobsInProgress,
      completedToday,
      cancelledToday,
    },
    pendingJobs,
    openRepairs,
    recentJobs,
  }
}
