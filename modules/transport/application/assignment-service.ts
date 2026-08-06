import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { ACTIVE_JOB_STATUSES } from "@/shared/transport/job-status-groups"
import { isScheduledTodayBangkok } from "./transport-date-utils"
import { vehicleHasOpenInRepair } from "./repair-service"

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

function assertVehicleAssignable(status: string, plateNumber: string) {
  if (status === "maintenance") {
    throw new ValidationError(`รถ ${plateNumber} กำลังซ่อมบำรุง — ไม่สามารถมอบหมายใบงานได้`)
  }
  if (status === "inactive") {
    throw new ValidationError(`รถ ${plateNumber} ไม่ใช้งาน — ไม่สามารถมอบหมายใบงานได้`)
  }
}

/** True if another active job still uses this vehicle or driver (checked separately). */
async function hasOtherActiveAssignment(
  db: PrismaClient,
  params: {
    companyId: string
    excludeJobId: string
    vehicleId?: string
    driverId?: string
  }
): Promise<boolean> {
  if (!params.vehicleId && !params.driverId) return false
  const found = await db.transportJob.findFirst({
    where: {
      companyId: params.companyId,
      id: { not: params.excludeJobId },
      status: { in: [...ACTIVE_JOB_STATUSES] },
      assignment: params.vehicleId
        ? { vehicleId: params.vehicleId }
        : { driverId: params.driverId! },
    },
    select: { id: true },
  })
  return !!found
}

/**
 * Prisma ops to set vehicle/driver available only when idle.
 * Does not throw — callers always close the current job; fleet is released selectively.
 */
async function buildFleetReleaseOps(
  db: PrismaClient,
  params: {
    companyId: string
    excludeJobId: string
    vehicleId: string
    driverId: string
  }
) {
  const [vehicleStillBusy, driverStillBusy, inRepair] = await Promise.all([
    hasOtherActiveAssignment(db, {
      companyId: params.companyId,
      excludeJobId: params.excludeJobId,
      vehicleId: params.vehicleId,
    }),
    hasOtherActiveAssignment(db, {
      companyId: params.companyId,
      excludeJobId: params.excludeJobId,
      driverId: params.driverId,
    }),
    vehicleHasOpenInRepair(db, {
      companyId: params.companyId,
      vehicleId: params.vehicleId,
    }),
  ])

  const ops: Array<
    ReturnType<PrismaClient["transportVehicle"]["update"]> | ReturnType<PrismaClient["driver"]["update"]>
  > = []

  if (!vehicleStillBusy && !inRepair) {
    ops.push(
      db.transportVehicle.update({
        where: { id: params.vehicleId },
        data: { currentStatus: "available" as const },
      })
    )
  }
  if (!driverStillBusy) {
    ops.push(
      db.driver.update({
        where: { id: params.driverId },
        data: { currentStatus: "available" },
      })
    )
  }
  return ops
}

export async function performAssignment(
  db: PrismaClient,
  params: PerformAssignmentParams
) {
  const vehicle = await db.transportVehicle.findFirst({
    where: { id: params.input.vehicleId, companyId: params.companyId },
  })
  if (!vehicle) throw new NotFoundError("Vehicle not found")
  assertVehicleAssignable(vehicle.currentStatus, vehicle.plateNumber)

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
      const fleetOps = await buildFleetReleaseOps(db, {
        companyId: params.companyId,
        excludeJobId: params.jobId,
        vehicleId: job.assignment.vehicleId,
        driverId: job.assignment.driverId,
      })
      await db.$transaction([
        db.transportJob.update({
          where: { id: params.jobId },
          data: { status: "completed" },
        }),
        db.jobAssignment.update({
          where: { jobId: params.jobId },
          data: { endTime: new Date() },
        }),
        ...fleetOps,
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

export async function cancelJob(
  db: PrismaClient,
  params: { jobId: string; companyId: string; roles: UserRole[] }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.jobId, companyId: params.companyId },
    include: { assignment: true },
  })
  if (!job) throw new NotFoundError("Job not found")
  if (job.status === "completed") throw new ValidationError("งานนี้จบแล้ว — ไม่สามารถยกเลิกได้")
  if (job.status === "cancelled") throw new ValidationError("งานนี้ถูกยกเลิกแล้ว")

  const canDelete =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "delete")
  if (!canDelete) throw new ForbiddenError()

  if (job.assignment) {
    const markAvailable = isScheduledTodayBangkok(job.scheduledDate)
    if (markAvailable) {
      const fleetOps = await buildFleetReleaseOps(db, {
        companyId: params.companyId,
        excludeJobId: params.jobId,
        vehicleId: job.assignment.vehicleId,
        driverId: job.assignment.driverId,
      })
      const [updated] = await db.$transaction([
        db.transportJob.update({
          where: { id: params.jobId },
          data: { status: "cancelled" },
        }),
        db.jobAssignment.update({
          where: { jobId: params.jobId },
          data: { endTime: new Date() },
        }),
        ...fleetOps,
      ])
      return updated
    }

    const [updated] = await db.$transaction([
      db.transportJob.update({
        where: { id: params.jobId },
        data: { status: "cancelled" },
      }),
      db.jobAssignment.update({
        where: { jobId: params.jobId },
        data: { endTime: new Date() },
      }),
    ])
    return updated
  }

  return db.transportJob.update({
    where: { id: params.jobId },
    data: { status: "cancelled" },
  })
}

async function findConflictingActiveJob(
  db: PrismaClient,
  params: {
    companyId: string
    excludeJobId: string
    vehicleId: string
    driverId: string
  }
) {
  return db.transportJob.findFirst({
    where: {
      companyId: params.companyId,
      id: { not: params.excludeJobId },
      status: { in: [...ACTIVE_JOB_STATUSES] },
      assignment: {
        OR: [{ vehicleId: params.vehicleId }, { driverId: params.driverId }],
      },
    },
    select: { id: true, jobNumber: true },
  })
}

export async function reopenJob(
  db: PrismaClient,
  params: { jobId: string; companyId: string; roles: UserRole[] }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.jobId, companyId: params.companyId },
    include: {
      assignment: {
        include: {
          vehicle: { select: { id: true, plateNumber: true, currentStatus: true } },
          driver: { select: { id: true } },
        },
      },
    },
  })
  if (!job) throw new NotFoundError("Job not found")
  if (job.status !== "completed" && job.status !== "cancelled") {
    throw new ValidationError("เปิดงานอีกครั้งได้เฉพาะใบงานที่เสร็จสิ้นหรือยกเลิกแล้ว")
  }

  const canUpdate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "update")
  if (!canUpdate) throw new ForbiddenError()

  if (!job.assignment) {
    await db.transportJob.update({
      where: { id: params.jobId },
      data: { status: "pending_assignment" },
    })
    return { success: true, status: "pending_assignment" as const }
  }

  const vehicle = job.assignment.vehicle
  assertVehicleAssignable(vehicle.currentStatus, vehicle.plateNumber)

  const markOnJob = isScheduledTodayBangkok(job.scheduledDate)
  if (markOnJob) {
    const conflict = await findConflictingActiveJob(db, {
      companyId: params.companyId,
      excludeJobId: params.jobId,
      vehicleId: job.assignment.vehicleId,
      driverId: job.assignment.driverId,
    })
    if (conflict) {
      throw new ValidationError(
        `รถหรือคนขับมีใบงานที่ยังไม่จบ (${conflict.jobNumber}) — จบ/ยกเลิกใบนั้นหรือเปลี่ยนมอบหมายก่อนเปิดงานอีกครั้ง`
      )
    }

    await db.$transaction([
      db.transportJob.update({
        where: { id: params.jobId },
        data: { status: "assigned" },
      }),
      db.jobAssignment.update({
        where: { jobId: params.jobId },
        data: { endTime: null },
      }),
      db.transportVehicle.update({
        where: { id: job.assignment.vehicleId },
        data: { currentStatus: "on_job" as const },
      }),
      db.driver.update({
        where: { id: job.assignment.driverId },
        data: { currentStatus: "on_job" },
      }),
    ])
  } else {
    await db.$transaction([
      db.transportJob.update({
        where: { id: params.jobId },
        data: { status: "assigned" },
      }),
      db.jobAssignment.update({
        where: { jobId: params.jobId },
        data: { endTime: null },
      }),
    ])
  }

  return { success: true, status: "assigned" as const }
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
    const fleetOps = await buildFleetReleaseOps(db, {
      companyId: params.companyId,
      excludeJobId: params.jobId,
      vehicleId: job.assignment.vehicleId,
      driverId: job.assignment.driverId,
    })
    await db.$transaction([
      db.jobAssignment.delete({ where: { jobId: params.jobId } }),
      db.transportJob.update({ where: { id: params.jobId }, data: { status: "pending_assignment" } }),
      ...fleetOps,
    ])
  } else {
    await db.$transaction([
      db.jobAssignment.delete({ where: { jobId: params.jobId } }),
      db.transportJob.update({ where: { id: params.jobId }, data: { status: "pending_assignment" } }),
    ])
  }

  return { success: true }
}
