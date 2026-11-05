import { randomBytes } from "crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { type UserRole } from "@/lib/permissions"
import { ACTIVE_JOB_STATUSES } from "@/shared/transport/job-status-groups"
import { canTransportJobs, transportJobListBranchIds } from "./transport-job-access"
import {
  PICKUP_MAX_OPEN_PER_CUSTOMER,
  canAttachToJob,
  isPickupPublicToken,
  pickupDisplayStatus,
  pickupLineLabel,
  PICKUP_CARGO_NAMES,
  PICKUP_UNIT_CODES,
  pickupCargoTypes,
  pickupRequestToStopDraft,
  pickupUnits,
  submitPickupRequestSchema,
  type PickupDisplayStatus,
} from "./pickup-request-rules"

type Db = PrismaClient | Prisma.TransactionClient

export type PickupRequestView = "queue" | "scheduled" | "all"

const LIST_LIMIT = 200
const PUBLIC_HISTORY_LIMIT = 20
const ATTACHABLE_SCAN_LIMIT = 300

const INACTIVE_STOP_STATUSES = ["skipped", "cancelled"] as const

function canWritePickup(roles: UserRole[]) {
  return canTransportJobs(roles, "create") || canTransportJobs(roles, "update")
}

export function createPickupPublicToken(): string {
  return randomBytes(32).toString("base64url")
}

export function pickupPublicPath(token: string) {
  return `/receive/${token}`
}

const requestInclude = {
  customer: { select: { id: true, name: true, address: true, contactName: true, phone: true } },
  lines: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      cargoType: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
    },
  },
  jobStop: {
    select: {
      id: true,
      status: true,
      estimatedArrival: true,
      punches: { select: { recordedAt: true } },
      job: { select: { id: true, jobNumber: true, status: true, scheduledDate: true } },
    },
  },
} satisfies Prisma.TmsPickupRequestInclude

type RequestRow = Prisma.TmsPickupRequestGetPayload<{ include: typeof requestInclude }>

function serializeRequest(row: RequestRow) {
  const view = pickupDisplayStatus(row)
  return {
    id: row.id,
    requestNo: row.requestNo,
    createdAt: row.createdAt.toISOString(),
    contactName: row.contactName,
    phone: row.phone,
    note: row.note,
    customer: row.customer,
    lines: row.lines.map((line) => ({
      id: line.id,
      cargoTypeId: line.cargoTypeId,
      cargoTypeName: line.cargoType.name,
      quantity: Number(line.quantity),
      unitId: line.unitId,
      unitName: line.unit.name,
      note: line.note,
      label: pickupLineLabel(line),
    })),
    displayStatus: view.status,
    plannedAt: view.plannedAt?.toISOString() ?? null,
    pickedAt: view.pickedAt?.toISOString() ?? null,
    job:
      row.jobStop && view.status !== "requeue"
        ? { id: row.jobStop.job.id, jobNumber: row.jobStop.job.jobNumber }
        : null,
  }
}

export type PickupRequestDto = ReturnType<typeof serializeRequest>

function queueWhere(): Prisma.TmsPickupRequestWhereInput {
  return {
    status: "SUBMITTED",
    OR: [
      { jobStopId: null },
      { jobStop: { status: { in: [...INACTIVE_STOP_STATUSES] } } },
      { jobStop: { job: { status: "cancelled" } } },
    ],
  }
}

function scheduledWhere(): Prisma.TmsPickupRequestWhereInput {
  return {
    status: "SUBMITTED",
    jobStop: {
      status: { notIn: [...INACTIVE_STOP_STATUSES] },
      job: { status: { not: "cancelled" } },
    },
  }
}

export async function issueCustomerPickupToken(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; customerId: string }
) {
  if (!canWritePickup(params.roles)) throw new ForbiddenError()
  const customer = await db.tmsCustomer.findFirst({
    where: { id: params.customerId, companyId: params.companyId },
    select: { id: true },
  })
  if (!customer) throw new NotFoundError("ไม่พบลูกค้า")
  const publicToken = createPickupPublicToken()
  await db.tmsCustomer.update({ where: { id: customer.id }, data: { publicToken } })
  return { publicToken, publicPath: pickupPublicPath(publicToken) }
}

async function findCustomerByToken(db: Db, token: string) {
  if (!isPickupPublicToken(token)) throw new NotFoundError("ไม่พบลิงก์นี้")
  const customer = await db.tmsCustomer.findUnique({
    where: { publicToken: token },
    select: { id: true, companyId: true, name: true, isActive: true },
  })
  if (!customer || !customer.isActive) throw new NotFoundError("ไม่พบลิงก์นี้")
  return customer
}

export async function getPublicPickupPage(db: PrismaClient, token: string) {
  const customer = await findCustomerByToken(db, token)
  const [cargoTypes, units, requests] = await Promise.all([
    db.transportCargoType.findMany({
      where: { companyId: customer.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.unit.findMany({
      where: { companyId: customer.companyId, isActive: true },
      select: { id: true, code: true, name: true },
    }),
    db.tmsPickupRequest.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: PUBLIC_HISTORY_LIMIT,
      include: requestInclude,
    }),
  ])

  return {
    customerName: customer.name,
    cargoTypes: pickupCargoTypes(cargoTypes),
    units: pickupUnits(units).map(({ id, name }) => ({ id, name })),
    requests: requests.map((row) => {
      const dto = serializeRequest(row)
      return {
        id: dto.id,
        requestNo: dto.requestNo,
        createdAt: dto.createdAt,
        note: dto.note,
        lines: dto.lines.map((line) => line.label),
        displayStatus: dto.displayStatus,
        plannedAt: dto.plannedAt,
        pickedAt: dto.pickedAt,
      }
    }),
  }
}

export type PublicPickupPage = Awaited<ReturnType<typeof getPublicPickupPage>>

async function nextRequestNo(db: Db, companyId: string) {
  const latest = await db.tmsPickupRequest.findFirst({
    where: { companyId },
    orderBy: { requestNo: "desc" },
    select: { requestNo: true },
  })
  return (latest?.requestNo ?? 0) + 1
}

function isRequestNoClash(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes("request_no")
  )
}

export async function submitPublicPickupRequest(db: PrismaClient, token: string, body: unknown) {
  const customer = await findCustomerByToken(db, token)
  const parsed = submitPickupRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง")
  }
  const input = parsed.data

  const cargoIds = [...new Set(input.lines.map((line) => line.cargoTypeId))]
  const unitIds = [...new Set(input.lines.map((line) => line.unitId))]
  const [cargoCount, unitCount, openCount] = await Promise.all([
    db.transportCargoType.count({
      where: {
        id: { in: cargoIds },
        companyId: customer.companyId,
        isActive: true,
        name: { in: [...PICKUP_CARGO_NAMES] },
      },
    }),
    db.unit.count({
      where: {
        id: { in: unitIds },
        companyId: customer.companyId,
        isActive: true,
        code: { in: [...PICKUP_UNIT_CODES] },
      },
    }),
    db.tmsPickupRequest.count({ where: { customerId: customer.id, ...queueWhere() } }),
  ])
  if (cargoCount !== cargoIds.length) throw new ValidationError("ประเภทสินค้าไม่ถูกต้อง")
  if (unitCount !== unitIds.length) throw new ValidationError("หน่วยไม่ถูกต้อง")
  if (openCount >= PICKUP_MAX_OPEN_PER_CUSTOMER) {
    throw new ValidationError(
      `มีคำขอที่รอจัดคิวอยู่ ${openCount} รายการ กรุณารอพนักงานจัดคิวก่อนแจ้งเพิ่ม`
    )
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await db.tmsPickupRequest.create({
        data: {
          companyId: customer.companyId,
          customerId: customer.id,
          requestNo: await nextRequestNo(db, customer.companyId),
          contactName: input.contactName || null,
          phone: input.phone || null,
          note: input.note || null,
          lines: {
            create: input.lines.map((line, index) => ({
              cargoTypeId: line.cargoTypeId,
              quantity: new Prisma.Decimal(line.quantity),
              unitId: line.unitId,
              note: line.note || null,
              sortOrder: index,
            })),
          },
        },
        select: { id: true, requestNo: true },
      })
      return created
    } catch (error) {
      if (isRequestNoClash(error) && attempt < 4) continue
      throw error
    }
  }
  throw new Error("Failed to allocate pickup request number")
}

export async function listPickupRequests(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; view: PickupRequestView }
) {
  if (!canTransportJobs(params.roles, "read")) throw new ForbiddenError()
  const viewWhere =
    params.view === "queue" ? queueWhere() : params.view === "scheduled" ? scheduledWhere() : {}
  const rows = await db.tmsPickupRequest.findMany({
    where: { companyId: params.companyId, ...viewWhere },
    orderBy: params.view === "queue" ? { createdAt: "asc" } : { createdAt: "desc" },
    take: LIST_LIMIT,
    include: requestInclude,
  })
  return rows.map(serializeRequest)
}

export async function getPickupRequest(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canTransportJobs(params.roles, "read")) throw new ForbiddenError()
  const row = await db.tmsPickupRequest.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: requestInclude,
  })
  if (!row) throw new NotFoundError("ไม่พบคำขอ")
  return { ...serializeRequest(row), stopDraft: pickupRequestToStopDraft(row) }
}

export async function cancelPickupRequest(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canWritePickup(params.roles)) throw new ForbiddenError()
  const row = await db.tmsPickupRequest.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: requestInclude,
  })
  if (!row) throw new NotFoundError("ไม่พบคำขอ")
  const status = pickupDisplayStatus(row).status
  if (status === "picked") throw new ValidationError("คำขอนี้รับสินค้าแล้ว ยกเลิกไม่ได้")
  if (status === "scheduled" || status === "in_progress") {
    throw new ValidationError("คำขอนี้อยู่ในใบงานแล้ว ให้ลบจุดแวะออกจากใบงานก่อน")
  }
  await db.tmsPickupRequest.update({ where: { id: row.id }, data: { status: "CANCELLED" } })
  return { ok: true }
}

/**
 * Loads a request that may be linked to a new stop. Throws unless it is waiting or re-queued,
 * so the caller can link it without stealing it from a live stop.
 */
export async function loadLinkablePickupRequest(db: Db, companyId: string, requestId: string) {
  const row = await db.tmsPickupRequest.findFirst({
    where: { id: requestId, companyId },
    include: requestInclude,
  })
  if (!row) throw new NotFoundError("ไม่พบคำขอ")
  const status: PickupDisplayStatus = pickupDisplayStatus(row).status
  if (status === "cancelled") throw new ValidationError(`คำขอ #${row.requestNo} ถูกยกเลิกแล้ว`)
  if (status !== "waiting" && status !== "requeue") {
    throw new ValidationError(`คำขอ #${row.requestNo} ถูกจัดเข้าใบงานแล้ว`)
  }
  return row
}

export async function listAttachableJobs(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canTransportJobs(params.roles, "update")) throw new ForbiddenError()
  const limited = await transportJobListBranchIds(db, params.companyId, params.roles)
  const jobs = await db.transportJob.findMany({
    where: {
      companyId: params.companyId,
      status: { in: ACTIVE_JOB_STATUSES.filter((status) => status !== "pending_review") },
      ...(limited ? { branchId: { in: limited } } : {}),
    },
    orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
    take: ATTACHABLE_SCAN_LIMIT,
    select: {
      id: true,
      jobNumber: true,
      status: true,
      scheduledDate: true,
      customerName: true,
      customer: { select: { name: true } },
      branch: { select: { name: true } },
      stops: { select: { id: true, sequence: true, status: true } },
      punches: { select: { stopId: true, kind: true } },
      assignment: {
        select: {
          vehicle: { select: { plateNumber: true } },
          driver: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  return jobs.flatMap((job) => {
    const check = canAttachToJob(job)
    if (!check.ok) return []
    const driver = job.assignment?.driver
    return [
      {
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
        running: check.running,
        scheduledDate: job.scheduledDate?.toISOString() ?? null,
        customerName: job.customerName ?? job.customer?.name ?? null,
        branchName: job.branch.name,
        stopCount: job.stops.length,
        plateNumber: job.assignment?.vehicle.plateNumber ?? null,
        driverName: driver ? `${driver.firstName} ${driver.lastName}`.trim() : null,
      },
    ]
  })
}
