import type { PrismaClient } from "@prisma/client"
import { ValidationError } from "@/lib/errors"

export type CalendarJob = {
  id: string
  jobNumber: string
  scheduledDate: string
  status: string
  customerName: string | null
  jobType: string
  priority: string
  branchId: string
  vehicle: { id: string; plateNumber: string; name: string } | null
  driver: { firstName: string; lastName: string } | null
  stopsCount: number
}

export async function listCalendarJobs(
  db: PrismaClient,
  params: { companyId: string; from: string | null; to: string | null; vehicleId?: string | null }
): Promise<CalendarJob[]> {
  const { companyId, from, to, vehicleId } = params

  if (!from || !to) {
    throw new ValidationError("from and to query params are required")
  }

  const fromDate = new Date(from)
  const toDate = new Date(to)
  toDate.setHours(23, 59, 59, 999)

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new ValidationError("Invalid date format")
  }

  const jobs = await db.transportJob.findMany({
    where: {
      companyId,
      scheduledDate: { gte: fromDate, lte: toDate },
      ...(vehicleId ? { assignment: { vehicleId } } : {}),
    },
    include: {
      assignment: {
        include: {
          vehicle: { select: { id: true, plateNumber: true, name: true } },
          driver: { select: { firstName: true, lastName: true } },
        },
      },
      _count: { select: { stops: true } },
    },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
  })

  return jobs.map((job) => ({
    id: job.id,
    jobNumber: job.jobNumber,
    scheduledDate: job.scheduledDate!.toISOString(),
    status: job.status,
    customerName: job.customerName,
    jobType: job.jobType,
    priority: job.priority,
    branchId: job.branchId,
    vehicle: job.assignment?.vehicle ?? null,
    driver: job.assignment?.driver ?? null,
    stopsCount: job._count.stops,
  }))
}
