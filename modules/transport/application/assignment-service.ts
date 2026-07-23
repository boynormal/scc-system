import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { isScheduledTodayBangkok } from "./transport-date-utils"

export const assignJobSchema = z.object({
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid(),
  notes: z.string().optional(),
})

export type AssignJobInput = z.infer<typeof assignJobSchema>

type PerformAssignmentParams = {
  jobId: string
  companyId: string
  userId: string
  scheduledDate: Date | null
  input: AssignJobInput
}

export async function performAssignment(
  db: PrismaClient,
  params: PerformAssignmentParams
) {
  const vehicle = await db.transportVehicle.findFirst({
    where: { id: params.input.vehicleId, companyId: params.companyId },
  })
  if (!vehicle) throw new NotFoundError("Vehicle not found")

  const driver = await db.driver.findFirst({
    where: { id: params.input.driverId, companyId: params.companyId },
  })
  if (!driver) throw new NotFoundError("Driver not found")

  const markOnJob = isScheduledTodayBangkok(params.scheduledDate)

  if (markOnJob) {
    const [assignment] = await db.$transaction([
      db.jobAssignment.upsert({
        where: { jobId: params.jobId },
        create: {
          jobId: params.jobId,
          vehicleId: params.input.vehicleId,
          driverId: params.input.driverId,
          assignedBy: params.userId,
          notes: params.input.notes,
        },
        update: {
          vehicleId: params.input.vehicleId,
          driverId: params.input.driverId,
          assignedBy: params.userId,
          notes: params.input.notes,
          assignedAt: new Date(),
        },
      }),
      db.transportJob.update({
        where: { id: params.jobId },
        data: { status: "assigned" },
      }),
      db.transportVehicle.update({
        where: { id: params.input.vehicleId },
        data: { currentStatus: "on_job" },
      }),
      db.driver.update({
        where: { id: params.input.driverId },
        data: { currentStatus: "on_job" },
      }),
    ])
    return assignment
  }

  const [assignment] = await db.$transaction([
    db.jobAssignment.upsert({
      where: { jobId: params.jobId },
      create: {
        jobId: params.jobId,
        vehicleId: params.input.vehicleId,
        driverId: params.input.driverId,
        assignedBy: params.userId,
        notes: params.input.notes,
      },
      update: {
        vehicleId: params.input.vehicleId,
        driverId: params.input.driverId,
        assignedBy: params.userId,
        notes: params.input.notes,
        assignedAt: new Date(),
      },
    }),
    db.transportJob.update({
      where: { id: params.jobId },
      data: { status: "assigned" },
    }),
  ])
  return assignment
}

export async function getAssignment(
  db: PrismaClient,
  params: { jobId: string; companyId: string; roles: UserRole[] }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.jobId, companyId: params.companyId },
  })
  if (!job) throw new NotFoundError("Job not found")
  const canRead =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "read")
  if (!canRead) throw new ForbiddenError()

  return db.jobAssignment.findUnique({
    where: { jobId: params.jobId },
    include: {
      vehicle: { select: { id: true, plateNumber: true, name: true, vehicleType: true, gpsDeviceId: true } },
      driver: { select: { id: true, firstName: true, lastName: true, phone: true, code: true } },
      assignedByUser: { select: { id: true, firstName: true, lastName: true } },
    },
  })
}

export async function assignJob(
  db: PrismaClient,
  params: {
    jobId: string
    companyId: string
    userId: string
    roles: UserRole[]
    input: AssignJobInput
  }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.jobId, companyId: params.companyId },
  })
  if (!job) throw new NotFoundError("Job not found")
  if (job.status === "completed" || job.status === "cancelled") {
    throw new ValidationError("Cannot assign a completed or cancelled job")
  }
  const canUpdate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "update")
  if (!canUpdate) throw new ForbiddenError()

  return performAssignment(db, {
    jobId: params.jobId,
    companyId: params.companyId,
    userId: params.userId,
    scheduledDate: job.scheduledDate,
    input: params.input,
  })
}

export async function completeJob(
  db: PrismaClient,
  params: { jobId: string; companyId: string; roles: UserRole[] }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.jobId, companyId: params.companyId },
    include: { assignment: true },
  })
  if (!job) throw new NotFoundError("Job not found")
  if (job.status === "completed") throw new ValidationError("งานนี้จบแล้ว")
  if (job.status === "cancelled") throw new ValidationError("งานนี้ถูกยกเลิกแล้ว")

  const canUpdate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "update")
  if (!canUpdate) throw new ForbiddenError()

  if (job.assignment) {
    const markAvailable = isScheduledTodayBangkok(job.scheduledDate)
    if (markAvailable) {
      await db.$transaction([
        db.transportJob.update({
          where: { id: params.jobId },
          data: { status: "completed" },
        }),
        db.jobAssignment.update({
          where: { jobId: params.jobId },
          data: { endTime: new Date() },
        }),
        db.transportVehicle.update({
          where: { id: job.assignment.vehicleId },
          data: { currentStatus: "available" },
        }),
        db.driver.update({
          where: { id: job.assignment.driverId },
          data: { currentStatus: "available" },
        }),
      ])
    } else {
      await db.$transaction([
        db.transportJob.update({
          where: { id: params.jobId },
          data: { status: "completed" },
        }),
        db.jobAssignment.update({
          where: { jobId: params.jobId },
          data: { endTime: new Date() },
        }),
      ])
    }
  } else {
    await db.transportJob.update({
      where: { id: params.jobId },
      data: { status: "completed" },
    })
  }

  return { success: true }
}

export async function unassignJob(
  db: PrismaClient,
  params: { jobId: string; companyId: string; roles: UserRole[] }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.jobId, companyId: params.companyId },
    include: { assignment: true },
  })
  if (!job) throw new NotFoundError("Job not found")
  if (!job.assignment) throw new NotFoundError("No assignment found for this job")
  const canUpdate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "update")
  if (!canUpdate) throw new ForbiddenError()

  const markAvailable = isScheduledTodayBangkok(job.scheduledDate)
  if (markAvailable) {
    await db.$transaction([
      db.jobAssignment.delete({ where: { jobId: params.jobId } }),
      db.transportJob.update({ where: { id: params.jobId }, data: { status: "pending_assignment" } }),
      db.transportVehicle.update({
        where: { id: job.assignment.vehicleId },
        data: { currentStatus: "available" },
      }),
      db.driver.update({
        where: { id: job.assignment.driverId },
        data: { currentStatus: "available" },
      }),
    ])
  } else {
    await db.$transaction([
      db.jobAssignment.delete({ where: { jobId: params.jobId } }),
      db.transportJob.update({ where: { id: params.jobId }, data: { status: "pending_assignment" } }),
    ])
  }

  return { success: true }
}
