import { describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import {
  addCalendarDays,
  assetPmSchedule,
  bangkokDateKey,
  bangkokMonthBounds,
  createPmPublicToken,
  deactivateAssetPm,
  getAssetPm,
  getPublicAssetPm,
  isPmPublicToken,
  listAssetPmBoard,
  summarizePmDayRounds,
  rotateAssetPmToken,
  submitPublicAssetPmRound,
  upsertAssetPm,
} from "@/modules/assets/application/asset-pm-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const CID_B = "00000000-0000-0000-0000-0000000000bb"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "22222222-2222-2222-2222-222222222222"
const ASSET_ID = "55555555-5555-5555-5555-555555555555"
const ASSET_B = "55555555-5555-5555-5555-555555555556"
const PLAN_ID = "77777777-7777-7777-7777-777777777777"
const ITEM_1 = "66666666-6666-4666-8666-666666666661"
const ITEM_2 = "66666666-6666-4666-8666-666666666662"
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789AB"

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null },
]
const viewerRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Viewer", permissions: null },
]
const technicianRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Technician", permissions: null },
]

type AssetRow = {
  id: string
  companyId: string
  branchId: string
  code: string
  name: string
  type: "VEHICLE" | "MACHINE"
  deletedAt: Date | null
}

type PlanItem = { id: string; planId: string; sequence: number; name: string }
type PlanRound = {
  id: string
  planId: string
  recordedAt: Date
  results: { sequence: number; itemName: string; status: string; remark: string | null; itemId?: string }[]
}
type PlanRow = {
  id: string
  assetId: string
  companyId: string
  intervalDays: number
  isActive: boolean
  publicToken: string
  items: PlanItem[]
  rounds: PlanRound[]
}

function assetRow(over: Partial<AssetRow> = {}): AssetRow {
  return {
    id: ASSET_ID,
    companyId: CID,
    branchId: BRANCH_A,
    code: "AST-2026-00001",
    name: "รถ A",
    type: "VEHICLE",
    deletedAt: null,
    ...over,
  }
}

function planRow(over: Partial<PlanRow> = {}): PlanRow {
  return {
    id: PLAN_ID,
    assetId: ASSET_ID,
    companyId: CID,
    intervalDays: 30,
    isActive: true,
    publicToken: TOKEN,
    items: [
      { id: ITEM_1, planId: PLAN_ID, sequence: 1, name: "ยางรถ" },
      { id: ITEM_2, planId: PLAN_ID, sequence: 2, name: "น้ำมันเครื่อง" },
    ],
    rounds: [],
    ...over,
  }
}

function matchesAsset(asset: AssetRow, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true
  if (typeof where.id === "string" && asset.id !== where.id) return false
  if (typeof where.companyId === "string" && asset.companyId !== where.companyId) return false
  if (where.deletedAt === null && asset.deletedAt) return false
  const branchId = where.branchId as { in?: string[] } | undefined
  if (branchId?.in && !branchId.in.includes(asset.branchId)) return false
  return true
}

function fakeDb(state: { assets: AssetRow[]; plans: PlanRow[] }) {
  const db = {
    asset: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const asset = state.assets.find((row) => matchesAsset(row, where))
        if (!asset) return null
        return { id: asset.id, code: asset.code, name: asset.name, type: asset.type }
      },
    },
    assetPmPlan: {
      findUnique: async ({ where }: { where: { assetId?: string; publicToken?: string; id?: string } }) => {
        const plan = state.plans.find((row) => {
          if (where.publicToken) return row.publicToken === where.publicToken
          if (where.assetId) return row.assetId === where.assetId
          if (where.id) return row.id === where.id
          return false
        })
        if (!plan) return null
        const asset = state.assets.find((row) => row.id === plan.assetId)
        return {
          ...plan,
          rounds: [...plan.rounds].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime()),
          asset: asset
            ? {
                id: asset.id,
                code: asset.code,
                name: asset.name,
                type: asset.type,
                deletedAt: asset.deletedAt,
              }
            : {
                id: "",
                code: "",
                name: "",
                type: "VEHICLE" as const,
                deletedAt: new Date(),
              },
        }
      },
      findMany: async ({ where }: { where: { companyId?: string; isActive?: boolean; asset?: Record<string, unknown> } }) => {
        return state.plans
          .filter((plan) => {
            if (where.companyId && plan.companyId !== where.companyId) return false
            if (typeof where.isActive === "boolean" && plan.isActive !== where.isActive) return false
            const asset = state.assets.find((row) => row.id === plan.assetId)
            return asset ? matchesAsset(asset, where.asset) : false
          })
          .map((plan) => {
            const asset = state.assets.find((row) => row.id === plan.assetId)!
            return {
              ...plan,
              asset: { id: asset.id, code: asset.code, name: asset.name, type: { name: "ยานพาหนะ" }, branch: { name: "HQ" } },
              rounds: [...plan.rounds]
                .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())
                .slice(0, 1),
            }
          })
      },
      count: async ({ where }: { where: { companyId?: string; isActive?: boolean; asset?: Record<string, unknown> } }) => {
        return state.plans.filter((plan) => {
          if (where.companyId && plan.companyId !== where.companyId) return false
          if (typeof where.isActive === "boolean" && plan.isActive !== where.isActive) return false
          const asset = state.assets.find((row) => row.id === plan.assetId)
          return asset ? matchesAsset(asset, where.asset) : false
        }).length
      },
      create: async ({
        data,
      }: {
        data: {
          assetId: string
          companyId: string
          intervalDays: number
          isActive: boolean
          publicToken: string
          items: { create: { sequence: number; name: string }[] }
          recordedBy?: string
        }
      }) => {
        if ("recordedBy" in data) throw new Error("plan must not store a checker")
        const plan = planRow({
          assetId: data.assetId,
          companyId: data.companyId,
          intervalDays: data.intervalDays,
          isActive: data.isActive,
          publicToken: data.publicToken,
          items: data.items.create.map((item, index) => ({
            id: `88888888-8888-4888-8888-88888888888${index}`,
            planId: PLAN_ID,
            sequence: item.sequence,
            name: item.name,
          })),
          rounds: [],
        })
        state.plans.push(plan)
        return plan
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: {
          publicToken?: string
          intervalDays?: number
          isActive?: boolean
          items?: { create: { sequence: number; name: string }[] }
        }
      }) => {
        const plan = state.plans.find((row) => row.id === where.id)
        if (!plan) throw new Error("missing plan")
        if (data.publicToken) plan.publicToken = data.publicToken
        if (data.intervalDays) plan.intervalDays = data.intervalDays
        if (typeof data.isActive === "boolean") plan.isActive = data.isActive
        if (data.items?.create) {
          plan.items = data.items.create.map((item, index) => ({
            id: `99999999-9999-4999-8999-99999999999${index}`,
            planId: plan.id,
            sequence: item.sequence,
            name: item.name,
          }))
        }
        return plan
      },
    },
    assetPmItem: {
      deleteMany: async ({ where }: { where: { planId: string } }) => {
        const plan = state.plans.find((row) => row.id === where.planId)
        const count = plan?.items.length ?? 0
        if (plan) plan.items = []
        return { count }
      },
    },
    assetPmRound: {
      create: async ({
        data,
      }: {
        data: {
          planId: string
          recordedBy?: string
          results: {
            create: {
              itemId: string
              sequence: number
              itemName: string
              status: string
              remark: string | null
            }[]
          }
        }
      }) => {
        if ("recordedBy" in data) throw new Error("round must not store a checker")
        const round: PlanRound = {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          planId: data.planId,
          recordedAt: new Date("2026-10-15T04:00:00.000Z"),
          results: data.results.create,
        }
        state.plans.find((row) => row.id === data.planId)?.rounds.unshift(round)
        return { id: round.id, recordedAt: round.recordedAt }
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return { db: db as unknown as PrismaClient, state }
}

describe("asset PM schedule", () => {
  const now = new Date("2026-10-15T02:00:00.000Z")

  it("uses the Bangkok calendar day", () => {
    expect(bangkokDateKey(new Date("2026-10-14T17:30:00.000Z"))).toBe("2026-10-15")
    expect(addCalendarDays("2026-10-01", 14)).toBe("2026-10-15")
    expect(bangkokMonthBounds(2026, 10)).toMatchObject({
      start: new Date("2026-09-30T17:00:00.000Z"),
      end: new Date("2026-10-31T17:00:00.000Z"),
      daysInMonth: 31,
    })
  })

  it("keeps the latest round of a Thai day and fails when any item failed", () => {
    const earlier = {
      recordedAt: new Date("2026-10-15T02:00:00.000Z"),
      results: [{ sequence: 1, itemName: "ยางรถ", status: "pass", remark: null }],
    }
    const latest = {
      recordedAt: new Date("2026-10-15T10:00:00.000Z"),
      results: [
        { sequence: 2, itemName: "น้ำมันเครื่อง", status: "fail", remark: "ต่ำ" },
        { sequence: 1, itemName: "ยางรถ", status: "pass", remark: null },
      ],
    }
    expect(summarizePmDayRounds([earlier, latest])).toMatchObject({
      status: "fail",
      roundCount: 2,
      results: [
        { sequence: 1, itemName: "ยางรถ", status: "pass" },
        { sequence: 2, itemName: "น้ำมันเครื่อง", status: "fail" },
      ],
    })
    expect(
      summarizePmDayRounds([
        {
          recordedAt: new Date("2026-10-15T10:00:00.000Z"),
          results: [{ sequence: 1, itemName: "ยางรถ", status: "pass", remark: null }],
        },
      ])?.status
    ).toBe("pass")
    expect(summarizePmDayRounds([])).toBeNull()
    expect(bangkokDateKey(new Date("2026-10-31T17:30:00.000Z"))).toBe("2026-11-01")
  })

  it("is due immediately when nobody has checked yet", () => {
    expect(assetPmSchedule({ isActive: true, intervalDays: 30, lastRecordedAt: null, now })).toEqual({
      dueStatus: "due",
      nextDueDate: "2026-10-15",
      lastRecordedAt: null,
    })
  })

  it("marks the due day, the days after it, and the days before it", () => {
    const last = new Date("2026-10-01T03:00:00.000Z")
    expect(assetPmSchedule({ isActive: true, intervalDays: 14, lastRecordedAt: last, now }).dueStatus).toBe("due")
    expect(
      assetPmSchedule({
        isActive: true,
        intervalDays: 14,
        lastRecordedAt: last,
        now: new Date("2026-10-16T02:00:00.000Z"),
      }).dueStatus
    ).toBe("overdue")
    expect(assetPmSchedule({ isActive: true, intervalDays: 30, lastRecordedAt: last, now })).toMatchObject({
      dueStatus: "ok",
      nextDueDate: "2026-10-31",
    })
  })

  it("does not treat an inactive plan as due", () => {
    expect(
      assetPmSchedule({
        isActive: false,
        intervalDays: 7,
        lastRecordedAt: null,
        now,
      }).dueStatus
    ).toBe("inactive")
  })
})

describe("asset PM access", () => {
  it("hides another company's asset and blocks readers from editing", async () => {
    const { db } = fakeDb({
      assets: [assetRow({ companyId: CID_B })],
      plans: [planRow({ companyId: CID_B })],
    })
    await expect(getAssetPm(db, { companyId: CID, roles: adminRoles, assetId: ASSET_ID })).rejects.toBeInstanceOf(
      NotFoundError
    )
    const own = fakeDb({ assets: [assetRow()], plans: [planRow()] })
    await expect(
      upsertAssetPm(own.db, {
        companyId: CID,
        roles: viewerRoles,
        assetId: ASSET_ID,
        input: { intervalDays: 30, isActive: true, items: [{ name: "ยางรถ" }] },
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      rotateAssetPmToken(own.db, { companyId: CID, roles: technicianRoles, assetId: ASSET_ID })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("lists only plans on branches the reader can see", async () => {
    const { db } = fakeDb({
      assets: [assetRow(), assetRow({ id: ASSET_B, branchId: BRANCH_B, code: "AST-2026-00002", name: "รถ B" })],
      plans: [planRow(), planRow({ id: "77777777-7777-7777-7777-777777777778", assetId: ASSET_B, publicToken: `${TOKEN}cd` })],
    })
    const tech = await listAssetPmBoard(db, { companyId: CID, roles: technicianRoles })
    expect(tech.data.map((row) => row.assetId)).toEqual([ASSET_ID])
    const admin = await listAssetPmBoard(db, { companyId: CID, roles: adminRoles })
    expect(admin.total).toBe(2)
    const closed = fakeDb({
      assets: [assetRow()],
      plans: [planRow({ isActive: false })],
    })
    const hidden = await listAssetPmBoard(closed.db, { companyId: CID, roles: adminRoles })
    expect(hidden.total).toBe(0)
  })

  it("turns a plan off without deleting its checklist", async () => {
    const { db, state } = fakeDb({ assets: [assetRow()], plans: [planRow()] })
    await expect(
      deactivateAssetPm(db, { companyId: CID, roles: viewerRoles, assetId: ASSET_ID })
    ).rejects.toBeInstanceOf(ForbiddenError)
    const result = await deactivateAssetPm(db, { companyId: CID, roles: adminRoles, assetId: ASSET_ID })
    expect(result.data.plan?.isActive).toBe(false)
    expect(result.data.plan?.items.map((item) => item.name)).toEqual(["ยางรถ", "น้ำมันเครื่อง"])
    expect(state.plans[0]?.isActive).toBe(false)
    const board = await listAssetPmBoard(db, { companyId: CID, roles: adminRoles })
    expect(board.total).toBe(0)
    await expect(getPublicAssetPm(db, TOKEN)).rejects.toBeInstanceOf(NotFoundError)
  })

  it("creates a tokenized plan and replaces items without keeping a checker", async () => {
    const created = fakeDb({ assets: [assetRow()], plans: [] })
    const result = await upsertAssetPm(created.db, {
      companyId: CID,
      roles: adminRoles,
      assetId: ASSET_ID,
      input: { intervalDays: 14, isActive: true, items: [{ name: "ยางรถ" }, { name: "น้ำมันเครื่อง" }] },
    })
    expect(result.data.plan?.items.map((item) => item.name)).toEqual(["ยางรถ", "น้ำมันเครื่อง"])
    expect(isPmPublicToken(result.data.plan?.publicToken ?? "")).toBe(true)
    expect(result.data.plan?.publicPath.startsWith("/pm/")).toBe(true)

    const replaced = await upsertAssetPm(created.db, {
      companyId: CID,
      roles: adminRoles,
      assetId: ASSET_ID,
      input: { intervalDays: 7, isActive: true, items: [{ name: "น้ำหม้อน้ำ" }] },
    })
    expect(replaced.data.plan?.intervalDays).toBe(7)
    expect(replaced.data.plan?.items.map((item) => item.name)).toEqual(["น้ำหม้อน้ำ"])

    const before = replaced.data.plan?.publicToken
    const rotated = await rotateAssetPmToken(created.db, {
      companyId: CID,
      roles: adminRoles,
      assetId: ASSET_ID,
    })
    expect(rotated.data.plan?.publicToken).not.toBe(before)
    expect(isPmPublicToken(rotated.data.plan?.publicToken ?? "")).toBe(true)
  })
})

describe("public asset PM round", () => {
  it("rejects a bad token, a closed plan, and a deleted asset", async () => {
    const { db, state } = fakeDb({ assets: [assetRow()], plans: [planRow()] })
    await expect(getPublicAssetPm(db, "nope")).rejects.toBeInstanceOf(NotFoundError)
    state.plans[0]!.isActive = false
    await expect(getPublicAssetPm(db, TOKEN)).rejects.toBeInstanceOf(NotFoundError)
    state.plans[0]!.isActive = true
    state.assets[0]!.deletedAt = new Date()
    await expect(submitPublicAssetPmRound(db, TOKEN, { results: [] })).rejects.toBeInstanceOf(NotFoundError)
  })

  it("requires every current item and stores the name without a user", async () => {
    const { db, state } = fakeDb({
      assets: [assetRow()],
      plans: [
        planRow({
          rounds: [
            {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              planId: PLAN_ID,
              recordedAt: new Date("2026-10-15T01:00:00.000Z"),
              results: [],
            },
          ],
        }),
      ],
    })
    await expect(
      submitPublicAssetPmRound(db, TOKEN, {
        results: [{ itemId: ITEM_1, status: "pass", remark: null }],
      })
    ).rejects.toBeInstanceOf(ValidationError)

    const saved = await submitPublicAssetPmRound(db, TOKEN, {
      results: [
        { itemId: ITEM_2, status: "fail", remark: "ต่ำ" },
        { itemId: ITEM_1, status: "pass", remark: "" },
      ],
    })
    expect(saved.data.id).toBeTruthy()
    const round = state.plans[0]?.rounds[0]
    expect(round?.results).toEqual([
      { itemId: ITEM_1, sequence: 1, itemName: "ยางรถ", status: "pass", remark: null },
      { itemId: ITEM_2, sequence: 2, itemName: "น้ำมันเครื่อง", status: "fail", remark: "ต่ำ" },
    ])
    expect(createPmPublicToken()).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})
