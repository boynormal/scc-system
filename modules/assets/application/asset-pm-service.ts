import { randomBytes } from "crypto"
import { z } from "zod"
import { Prisma, type PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { readBranchSharing } from "@/shared/permissions/branch-sharing"
import { assetWhere } from "./asset-service"

export const PM_CHECK_STATUSES = ["pass", "fail", "na"] as const
export type PmCheckStatus = (typeof PM_CHECK_STATUSES)[number]
/** New public rounds only. Older rows may still store "na". */
export const PM_SUBMIT_STATUSES = ["pass", "fail"] as const
export type AssetPmDueStatus = "due" | "overdue" | "ok" | "inactive"

const BANGKOK = "Asia/Bangkok"
const HISTORY_LIMIT = 20
const BOARD_PAGE_SIZE = 50
const NOT_FOUND = "ไม่พบรายการ"

export const upsertAssetPmSchema = z.object({
  intervalDays: z.number().int().min(1).max(3650).default(30),
  isActive: z.boolean().default(true),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(255),
      })
    )
    .min(1)
    .max(50),
})

export const submitAssetPmRoundSchema = z.object({
  results: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        status: z.enum(PM_SUBMIT_STATUSES),
        remark: z
          .string()
          .trim()
          .max(500)
          .optional()
          .nullable()
          .transform((value) => (value ? value : null)),
      })
    )
    .min(1)
    .max(50),
})

export type UpsertAssetPmInput = z.input<typeof upsertAssetPmSchema>
export type SubmitAssetPmRoundInput = z.input<typeof submitAssetPmRoundSchema>

const PUBLIC_TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/

export function isPmPublicToken(token: string): boolean {
  return PUBLIC_TOKEN_RE.test(token)
}

function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  return parsed.data
}

const planInclude = {
  items: { orderBy: { sequence: "asc" as const } },
  rounds: {
    orderBy: { recordedAt: "desc" as const },
    take: HISTORY_LIMIT,
    include: {
      results: { orderBy: { sequence: "asc" as const } },
    },
  },
} satisfies Prisma.AssetPmPlanInclude

type PlanRow = Prisma.AssetPmPlanGetPayload<{ include: typeof planInclude }>

function canAssets(roles: UserRole[], action: "read" | "update"): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", action))
  )
}

export function createPmPublicToken(): string {
  return randomBytes(32).toString("base64url")
}

export function bangkokDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function assetPmSchedule(params: {
  isActive: boolean
  intervalDays: number
  lastRecordedAt: Date | null
  now?: Date
}): { dueStatus: AssetPmDueStatus; nextDueDate: string | null; lastRecordedAt: string | null } {
  const now = params.now ?? new Date()
  const last = params.lastRecordedAt
  const lastRecordedAt = last ? last.toISOString() : null
  if (!params.isActive) {
    return {
      dueStatus: "inactive",
      nextDueDate: last ? addCalendarDays(bangkokDateKey(last), params.intervalDays) : null,
      lastRecordedAt,
    }
  }
  if (!last) {
    return { dueStatus: "due", nextDueDate: bangkokDateKey(now), lastRecordedAt: null }
  }
  const nextDueDate = addCalendarDays(bangkokDateKey(last), params.intervalDays)
  const today = bangkokDateKey(now)
  const dueStatus: AssetPmDueStatus =
    nextDueDate < today ? "overdue" : nextDueDate === today ? "due" : "ok"
  return { dueStatus, nextDueDate, lastRecordedAt }
}

function publicPath(token: string): string {
  return `/pm/${token}`
}

function serializePlan(row: PlanRow, now?: Date) {
  const schedule = assetPmSchedule({
    isActive: row.isActive,
    intervalDays: row.intervalDays,
    lastRecordedAt: row.rounds[0]?.recordedAt ?? null,
    now,
  })
  return {
    id: row.id,
    intervalDays: row.intervalDays,
    isActive: row.isActive,
    publicToken: row.publicToken,
    publicPath: publicPath(row.publicToken),
    ...schedule,
    items: row.items.map((item) => ({
      id: item.id,
      sequence: item.sequence,
      name: item.name,
    })),
    rounds: row.rounds.map((round) => ({
      id: round.id,
      recordedAt: round.recordedAt.toISOString(),
      results: round.results.map((result) => ({
        sequence: result.sequence,
        itemName: result.itemName,
        status: result.status,
        remark: result.remark,
      })),
    })),
  }
}

async function requireAsset(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; assetId: string },
  action: "read" | "update"
) {
  if (!canAssets(params.roles, action)) throw new ForbiddenError()
  const share = await readBranchSharing(db, params.companyId)
  const companyWide = action === "read" ? share.assets.view : share.assets.edit
  const asset = await db.asset.findFirst({
    where: {
      id: params.assetId,
      ...assetWhere(params.companyId, params.roles, null, companyWide),
    },
    select: { id: true, code: true, name: true, type: { select: { name: true } }, branch: { select: { name: true } } },
  })
  if (!asset) throw new NotFoundError(NOT_FOUND)
  return asset
}

async function loadPlan(db: PrismaClient, assetId: string) {
  return db.assetPmPlan.findUnique({
    where: { assetId },
    include: planInclude,
  })
}

export async function getAssetPm(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; assetId: string; now?: Date }
) {
  const asset = await requireAsset(db, params, "read")
  const plan = await loadPlan(db, asset.id)
  return {
    data: {
      asset,
      plan: plan ? serializePlan(plan, params.now) : null,
    },
  }
}

export async function upsertAssetPm(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    assetId: string
    input: unknown
  }
) {
  const asset = await requireAsset(db, params, "update")
  const input = parseInput(upsertAssetPmSchema, params.input)
  const items = input.items.map((item, index) => ({
    sequence: index + 1,
    name: item.name,
  }))
  const existing = await db.assetPmPlan.findUnique({
    where: { assetId: asset.id },
    select: { id: true },
  })

  if (!existing) {
    await db.assetPmPlan.create({
      data: {
        assetId: asset.id,
        companyId: params.companyId,
        intervalDays: input.intervalDays,
        isActive: input.isActive,
        publicToken: createPmPublicToken(),
        items: { create: items },
      },
    })
  } else {
    await db.$transaction(async (tx) => {
      await tx.assetPmItem.deleteMany({ where: { planId: existing.id } })
      await tx.assetPmPlan.update({
        where: { id: existing.id },
        data: {
          intervalDays: input.intervalDays,
          isActive: input.isActive,
          items: { create: items },
        },
      })
    })
  }

  return getAssetPm(db, params)
}

export async function rotateAssetPmToken(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; assetId: string }
) {
  const asset = await requireAsset(db, params, "update")
  const existing = await db.assetPmPlan.findUnique({
    where: { assetId: asset.id },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError(NOT_FOUND)
  await db.assetPmPlan.update({
    where: { id: existing.id },
    data: { publicToken: createPmPublicToken() },
  })
  return getAssetPm(db, params)
}

export async function deactivateAssetPm(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; assetId: string }
) {
  const asset = await requireAsset(db, params, "update")
  const existing = await db.assetPmPlan.findUnique({
    where: { assetId: asset.id },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError(NOT_FOUND)
  await db.assetPmPlan.update({
    where: { id: existing.id },
    data: { isActive: false },
  })
  return getAssetPm(db, params)
}

const boardInclude = {
  asset: { select: { id: true, code: true, name: true, type: { select: { name: true } }, branch: { select: { name: true } } } },
  items: { select: { id: true } },
  rounds: {
    orderBy: { recordedAt: "desc" as const },
    take: 1,
    select: { recordedAt: true },
  },
} satisfies Prisma.AssetPmPlanInclude

export async function listAssetPmBoard(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; page?: number; now?: Date }
) {
  if (!canAssets(params.roles, "read")) throw new ForbiddenError()
  const share = await readBranchSharing(db, params.companyId)
  const where: Prisma.AssetPmPlanWhereInput = {
    companyId: params.companyId,
    isActive: true,
    asset: assetWhere(params.companyId, params.roles, null, share.assets.view),
  }
  const page = params.page && params.page > 0 ? params.page : 1
  const rows = await db.assetPmPlan.findMany({
    where,
    include: boardInclude,
  })
  const rank: Record<string, number> = { overdue: 0, due: 1, ok: 2, inactive: 3 }
  const mapped = rows
    .map((row) => {
      const schedule = assetPmSchedule({
        isActive: row.isActive,
        intervalDays: row.intervalDays,
        lastRecordedAt: row.rounds[0]?.recordedAt ?? null,
        now: params.now,
      })
      return {
        assetId: row.asset.id,
        code: row.asset.code,
        name: row.asset.name,
        branchName: row.asset.branch.name,
        typeName: row.asset.type.name,
        publicPath: publicPath(row.publicToken),
        intervalDays: row.intervalDays,
        isActive: row.isActive,
        itemCount: row.items.length,
        ...schedule,
      }
    })
    .sort((a, b) => (rank[a.dueStatus] ?? 9) - (rank[b.dueStatus] ?? 9) || a.code.localeCompare(b.code))

  return {
    data: mapped.slice((page - 1) * BOARD_PAGE_SIZE, page * BOARD_PAGE_SIZE),
    summary: {
      overdue: mapped.filter((row) => row.dueStatus === "overdue").length,
      due: mapped.filter((row) => row.dueStatus === "due").length,
      ok: mapped.filter((row) => row.dueStatus === "ok").length,
    },
    total: mapped.length,
    page,
    pageSize: BOARD_PAGE_SIZE,
  }
}

const publicInclude = {
  items: { orderBy: { sequence: "asc" as const } },
  asset: { select: { name: true, code: true, deletedAt: true } },
  rounds: {
    orderBy: { recordedAt: "desc" as const },
    take: 1,
    select: { recordedAt: true },
  },
} satisfies Prisma.AssetPmPlanInclude

export async function getPublicAssetPm(db: PrismaClient, token: string, now?: Date) {
  const plan = await db.assetPmPlan.findUnique({
    where: { publicToken: token },
    include: publicInclude,
  })
  if (!plan || !plan.isActive || plan.asset.deletedAt) throw new NotFoundError(NOT_FOUND)
  const schedule = assetPmSchedule({
    isActive: plan.isActive,
    intervalDays: plan.intervalDays,
    lastRecordedAt: plan.rounds[0]?.recordedAt ?? null,
    now,
  })
  return {
    data: {
      assetName: plan.asset.name,
      assetCode: plan.asset.code,
      dueStatus: schedule.dueStatus,
      nextDueDate: schedule.nextDueDate,
      items: plan.items.map((item) => ({
        id: item.id,
        sequence: item.sequence,
        name: item.name,
      })),
    },
  }
}

export async function submitPublicAssetPmRound(
  db: PrismaClient,
  token: string,
  input: unknown
) {
  const plan = await db.assetPmPlan.findUnique({
    where: { publicToken: token },
    include: {
      items: { orderBy: { sequence: "asc" } },
      asset: { select: { deletedAt: true } },
    },
  })
  if (!plan || !plan.isActive || plan.asset.deletedAt) throw new NotFoundError(NOT_FOUND)

  const parsed = parseInput(submitAssetPmRoundSchema, input)
  const expected = new Set(plan.items.map((item) => item.id))
  const seen = new Set<string>()
  for (const result of parsed.results) {
    if (seen.has(result.itemId) || !expected.has(result.itemId)) {
      throw new ValidationError("ต้องบันทึกผลให้ครบทุกรายการ")
    }
    seen.add(result.itemId)
  }
  if (seen.size !== expected.size) throw new ValidationError("ต้องบันทึกผลให้ครบทุกรายการ")

  const byId = new Map(parsed.results.map((result) => [result.itemId, result]))
  const round = await db.assetPmRound.create({
    data: {
      planId: plan.id,
      results: {
        create: plan.items.map((item) => {
          const result = byId.get(item.id)
          if (!result) throw new ValidationError("ต้องบันทึกผลให้ครบทุกรายการ")
          return {
            itemId: item.id,
            sequence: item.sequence,
            itemName: item.name,
            status: result.status,
            remark: result.remark,
          }
        }),
      },
    },
    select: { id: true, recordedAt: true },
  })

  return {
    data: {
      id: round.id,
      recordedAt: round.recordedAt.toISOString(),
    },
  }
}

export type PmMonthCell = {
  status: "pass" | "fail"
  roundCount: number
  recordedAt: string
  results: { sequence: number; itemName: string; status: string; remark: string | null }[]
}

export function bangkokMonthBounds(year: number, month: number) {
  const startKey = `${year}-${String(month).padStart(2, "0")}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const endKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  return {
    start: new Date(`${startKey}T00:00:00+07:00`),
    end: new Date(`${endKey}T00:00:00+07:00`),
    daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
  }
}

export function summarizePmDayRounds(
  rounds: {
    recordedAt: Date
    results: { sequence: number; itemName: string; status: string; remark: string | null }[]
  }[]
): PmMonthCell | null {
  if (rounds.length === 0) return null
  const latest = [...rounds].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0]
  if (!latest) return null
  return {
    status: latest.results.some((result) => result.status === "fail") ? "fail" : "pass",
    roundCount: rounds.length,
    recordedAt: latest.recordedAt.toISOString(),
    results: [...latest.results].sort((a, b) => a.sequence - b.sequence),
  }
}

export function withPmCalendarAssetFilters(
  where: Prisma.AssetWhereInput,
  filters: { typeId?: string | null; search?: string | null }
): Prisma.AssetWhereInput {
  const next: Prisma.AssetWhereInput = { ...where }
  if (filters.typeId && z.string().uuid().safeParse(filters.typeId).success) {
    next.typeId = filters.typeId
  }
  const q = filters.search?.trim()
  if (q) {
    next.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ]
  }
  return next
}

export async function listAssetPmMonth(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    year: number
    month: number
    branchId?: string | null
    typeId?: string | null
    search?: string | null
  }
) {
  if (!canAssets(params.roles, "read")) throw new ForbiddenError()
  if (!Number.isInteger(params.year) || params.month < 1 || params.month > 12) {
    throw new ValidationError("เดือนไม่ถูกต้อง")
  }
  const share = await readBranchSharing(db, params.companyId)
  const { start, end, daysInMonth } = bangkokMonthBounds(params.year, params.month)
  const plans = await db.assetPmPlan.findMany({
    where: {
      companyId: params.companyId,
      isActive: true,
      asset: withPmCalendarAssetFilters(
        assetWhere(params.companyId, params.roles, params.branchId, share.assets.view),
        { typeId: params.typeId, search: params.search }
      ),
    },
    include: {
      asset: { select: { id: true, name: true, code: true, branch: { select: { name: true } } } },
      rounds: {
        where: { recordedAt: { gte: start, lt: end } },
        include: { results: true },
      },
    },
    orderBy: { asset: { name: "asc" } },
  })

  return {
    year: params.year,
    month: params.month,
    daysInMonth,
    rows: plans.map((plan) => {
      const byDay = new Map<number, typeof plan.rounds>()
      for (const round of plan.rounds) {
        const day = Number(bangkokDateKey(round.recordedAt).slice(8, 10))
        const list = byDay.get(day) ?? []
        list.push(round)
        byDay.set(day, list)
      }
      const cells: Record<string, PmMonthCell> = {}
      for (const [day, rounds] of byDay) {
        const cell = summarizePmDayRounds(rounds)
        if (cell) cells[String(day)] = cell
      }
      return {
        assetId: plan.asset.id,
        name: plan.asset.name,
        code: plan.asset.code,
        branchName: plan.asset.branch.name,
        cells,
      }
    }),
  }
}
