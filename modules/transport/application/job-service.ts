import { z } from "zod"
import type { PrismaClient, TransportJobStatus, TransportJobPriority, AttachmentStage } from "@prisma/client"
import { Prisma } from "@prisma/client"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import { hasPermission, isAdminInAnyBranch, getBranchIds, type UserRole } from "@/lib/permissions"
import { performAssignment } from "./assignment-service"
import {
  type JobListGroup,
  resolveJobListGroup,
  statusFilterForGroup,
} from "@/shared/transport/job-status-groups"

export const createJobSchema = z
  .object({
    branchId: z.string().uuid(),
    customerId: z.string().uuid().optional(),
    customerName: z.string().max(255).optional(),
    jobType: z.string().min(1).max(100),
    cargoType: z.string().max(100).optional(),
    estimatedWeightKg: z.number().positive().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    scheduledDate: z.coerce.date().optional(),
    notes: z.string().optional(),
    vehicleId: z.string().uuid(),
    driverId: z.string().uuid(),
    stops: z
      .array(
        z.object({
          sequence: z.number().int().min(1),
          customerName: z.string().min(1).max(255),
          address: z.string().min(1),
          contactName: z.string().max(255).optional(),
          contactPhone: z.string().max(30).optional(),
          estimatedArrival: z.string().datetime({ offset: true }).optional(),
          weightKg: z.number().positive().optional(),
          notes: z.string().optional(),
        })
      )
      .min(1, "At least one stop is required"),
  })

export const updateJobSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().max(255).nullable().optional(),
  jobType: z.string().max(100).optional(),
  cargoType: z.string().max(100).nullable().optional(),
  estimatedWeightKg: z.number().positive().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  scheduledDate: z.coerce.date().nullable().optional(),
  status: z
    .enum([
      "pending_assignment",
      "assigned",
      "driver_accepted",
      "en_route",
      "at_pickup",
      "loading",
      "departed",
      "at_destination",
      "unloading",
      "completed",
      "cancelled",
    ])
    .optional(),
  notes: z.string().nullable().optional(),
})

export const createStopSchema = z.object({
  sequence: z.number().int().min(1),
  customerName: z.string().min(1).max(255),
  address: z.string().min(1),
  contactName: z.string().max(255).optional(),
  contactPhone: z.string().max(30).optional(),
  estimatedArrival: z.string().datetime({ offset: true }).optional(),
  weightKg: z.number().positive().optional(),
  notes: z.string().optional(),
})

export const updateStopSchema = z.object({
  status: z.enum(["pending", "arrived", "loading", "completed", "skipped", "cancelled"]).optional(),
  actualArrival: z.string().datetime({ offset: true }).optional(),
  notes: z.string().optional(),
})

export const createAttachmentSchema = z.object({
  stopId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  fileUrl: z.string().url(),
  fileType: z.string().max(50),
  originalFileName: z.string().max(255),
  fileSizeBytes: z.number().int().positive().optional(),
  stage: z.enum(["before_trip", "at_pickup", "transit", "at_delivery", "after_trip"]),
  caption: z.string().optional(),
  takenAt: z.string().datetime({ offset: true }),
})

export type CreateJobInput = z.infer<typeof createJobSchema>
export type UpdateJobInput = z.infer<typeof updateJobSchema>

async function generateJobNumber(db: PrismaClient, companyId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `TJ-${year}-`

  const latest = await db.transportJob.findFirst({
    where: { companyId, jobNumber: { startsWith: prefix } },
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  })

  const nextSeq = latest
    ? (parseInt(latest.jobNumber.slice(prefix.length), 10) || 0) + 1
    : 1

  return `${prefix}${String(nextSeq).padStart(5, "0")}`
}

type JobListFilters = {
  companyId: string
  branchId?: string | null
  status?: TransportJobStatus | null
  statusGroup?: JobListGroup | null
  priority?: TransportJobPriority | null
  search?: string | null
}

function buildJobListWhere(params: JobListFilters) {
  const group = params.statusGroup ? resolveJobListGroup(params.statusGroup) : null

  return {
    companyId: params.companyId,
    ...(params.branchId ? { branchId: params.branchId } : {}),
    ...(group ? statusFilterForGroup(group) : params.status ? { status: params.status } : {}),
    ...(params.priority ? { priority: params.priority } : {}),
    ...(params.search
      ? {
          OR: [
            { jobNumber: { contains: params.search, mode: "insensitive" as const } },
            { customerName: { contains: params.search, mode: "insensitive" as const } },
            { jobType: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }
}

const jobListInclude = {
  branch: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  assignment: {
    include: {
      vehicle: { select: { id: true, plateNumber: true, name: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  _count: { select: { stops: true } },
} as const

export async function countJobsByGroup(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    priority?: TransportJobPriority | null
    search?: string | null
  }
): Promise<Record<JobListGroup, number>> {
  const canRead =
    isAdminInAnyBranch(params.roles) ||
    getBranchIds(params.roles).some((bid) => hasPermission(params.roles, bid, "transport_jobs", "read"))
  if (!canRead) throw new ForbiddenError()

  const base = {
    companyId: params.companyId,
    branchId: params.branchId ?? undefined,
    priority: params.priority ?? undefined,
    search: params.search ?? undefined,
  }

  const [active, completed, cancelled] = await Promise.all([
    db.transportJob.count({
      where: buildJobListWhere({ ...base, statusGroup: "active" }),
    }),
    db.transportJob.count({
      where: buildJobListWhere({ ...base, statusGroup: "completed" }),
    }),
    db.transportJob.count({
      where: buildJobListWhere({ ...base, statusGroup: "cancelled" }),
    }),
  ])

  return { active, completed, cancelled }
}

export async function listJobs(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    status?: TransportJobStatus | null
    statusGroup?: JobListGroup | null
    priority?: TransportJobPriority | null
    search?: string | null
    page: number
    pageSize: number
  }
) {
  const canRead =
    isAdminInAnyBranch(params.roles) ||
    getBranchIds(params.roles).some((bid) => hasPermission(params.roles, bid, "transport_jobs", "read"))
  if (!canRead) throw new ForbiddenError()

  const where = buildJobListWhere(params)

  const [total, items] = await Promise.all([
    db.transportJob.count({ where }),
    db.transportJob.findMany({
      where,
      include: jobListInclude,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ])

  return { total, page: params.page, pageSize: params.pageSize, items }
}

export async function getJobById(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: {
      branch: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
      stops: { orderBy: { sequence: "asc" } },
      assignment: {
        include: {
          vehicle: { select: { id: true, plateNumber: true, name: true, vehicleType: true } },
          driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
          assignedByUser: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      attachments: { orderBy: { takenAt: "asc" } },
    },
  })
  if (!job) throw new NotFoundError("Job not found")
  const canRead =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "read")
  if (!canRead) throw new ForbiddenError()
  return job
}

export async function createJob(
  db: PrismaClient,
  params: { companyId: string; userId: string; roles: UserRole[]; input: CreateJobInput }
) {
  const canCreate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, params.input.branchId, "transport_jobs", "create")
  if (!canCreate) throw new ForbiddenError()

  const { stops, vehicleId, driverId, ...jobData } = params.input

  let job: { id: string; scheduledDate: Date | null } | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const jobNumber = await generateJobNumber(db, params.companyId)
    try {
      job = await db.transportJob.create({
        data: {
          ...jobData,
          jobNumber,
          companyId: params.companyId,
          createdBy: params.userId,
          stops: { create: stops },
        },
        select: { id: true, scheduledDate: true },
      })
      break
    } catch (error) {
      const isDuplicateJobNumber =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        Array.isArray(error.meta?.target) &&
        (error.meta.target as string[]).includes("job_number")

      if (isDuplicateJobNumber && attempt < 4) continue
      throw error
    }
  }

  if (!job) throw new Error("Failed to generate unique job number")

  await performAssignment(db, {
    jobId: job.id,
    companyId: params.companyId,
    userId: params.userId,
    scheduledDate: job.scheduledDate,
    input: { vehicleId, driverId },
  })
  return db.transportJob.findFirstOrThrow({
    where: { id: job.id },
    include: {
      stops: true,
      assignment: {
        include: {
          vehicle: { select: { id: true, plateNumber: true, name: true, vehicleType: true } },
          driver: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  })
}

export async function updateJob(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[]; input: UpdateJobInput }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!job) throw new NotFoundError("Job not found")
  const canUpdate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "update")
  if (!canUpdate) throw new ForbiddenError()

  return db.transportJob.update({ where: { id: params.id }, data: params.input })
}

export async function deleteJob(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!job) throw new NotFoundError("Job not found")
  const canDelete =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "delete")
  if (!canDelete) throw new ForbiddenError()

  return db.transportJob.update({
    where: { id: params.id },
    data: { status: "cancelled" },
  })
}

export async function listStops(
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

  return db.jobStop.findMany({
    where: { jobId: params.jobId },
    orderBy: { sequence: "asc" },
  })
}

export async function addStop(
  db: PrismaClient,
  params: {
    jobId: string
    companyId: string
    roles: UserRole[]
    input: z.infer<typeof createStopSchema>
  }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.jobId, companyId: params.companyId },
  })
  if (!job) throw new NotFoundError("Job not found")
  const canUpdate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "update")
  if (!canUpdate) throw new ForbiddenError()

  return db.jobStop.create({ data: { ...params.input, jobId: params.jobId } })
}

export async function updateStop(
  db: PrismaClient,
  params: {
    jobId: string
    stopId: string
    companyId: string
    roles: UserRole[]
    input: z.infer<typeof updateStopSchema>
  }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.jobId, companyId: params.companyId },
  })
  if (!job) throw new NotFoundError("Job not found")
  const canUpdate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "update")
  if (!canUpdate) throw new ForbiddenError()

  const stop = await db.jobStop.findFirst({ where: { id: params.stopId, jobId: params.jobId } })
  if (!stop) throw new NotFoundError("Stop not found")

  return db.jobStop.update({
    where: { id: params.stopId },
    data: {
      ...params.input,
      ...(params.input.actualArrival ? { actualArrival: new Date(params.input.actualArrival) } : {}),
    },
  })
}

export async function listAttachments(
  db: PrismaClient,
  params: { jobId: string; companyId: string; roles: UserRole[]; stage?: AttachmentStage | null }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.jobId, companyId: params.companyId },
  })
  if (!job) throw new NotFoundError("Job not found")
  const canRead =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "read")
  if (!canRead) throw new ForbiddenError()

  return db.jobAttachment.findMany({
    where: { jobId: params.jobId, ...(params.stage ? { stage: params.stage } : {}) },
    orderBy: { takenAt: "asc" },
  })
}

export async function createAttachment(
  db: PrismaClient,
  params: {
    jobId: string
    companyId: string
    roles: UserRole[]
    userId: string
    input: z.infer<typeof createAttachmentSchema>
  }
) {
  const job = await db.transportJob.findFirst({
    where: { id: params.jobId, companyId: params.companyId },
  })
  if (!job) throw new NotFoundError("Job not found")
  const canUpdate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, job.branchId, "transport_jobs", "update")
  if (!canUpdate) throw new ForbiddenError()

  return db.jobAttachment.create({
    data: {
      ...params.input,
      jobId: params.jobId,
      takenAt: new Date(params.input.takenAt),
      uploadedBy: params.userId,
    },
  })
}
