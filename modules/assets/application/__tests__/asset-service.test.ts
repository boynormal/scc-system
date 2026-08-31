import { describe, expect, it } from "vitest"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import {
  ASSET_OWNERSHIPS,
  ASSET_STATUSES,
  ASSET_TYPES,
  createAsset,
  createAssetSchema,
  deleteAsset,
  formatAssetCode,
  getAsset,
  listAssets,
  parseAssetCodeSeq,
  suggestNextAssetCode,
  updateAsset,
} from "@/modules/assets/application/asset-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const CID_B = "00000000-0000-0000-0000-0000000000bb"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "22222222-2222-2222-2222-222222222222"
const SUPPLIER_A = "33333333-3333-3333-3333-333333333333"
const USER_ID = "44444444-4444-4444-4444-444444444444"
const ASSET_ID = "55555555-5555-5555-5555-555555555555"

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null },
]
const managerRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Manager", permissions: null },
]
const viewerRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Viewer", permissions: null },
]
const technicianRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Technician", permissions: null },
]
const noPermRoles: UserRole[] = [
  {
    branchId: BRANCH_A,
    branchName: "HQ",
    roleName: "Custom",
    permissions: { machines: ["read"] },
  },
]

const now = new Date("2026-08-31T00:00:00.000Z")

function serializedRow(over: Record<string, unknown> = {}) {
  return {
    id: ASSET_ID,
    companyId: CID,
    branchId: BRANCH_A,
    code: "AST-2026-00001",
    name: "Dump truck 01",
    type: "VEHICLE",
    status: "REGISTERED",
    ownership: "COMPANY",
    serialNumber: null,
    locationDetail: null,
    supplierId: null,
    acquiredAt: null,
    isActive: true,
    createdBy: USER_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    branch: { id: BRANCH_A, name: "HQ" },
    supplier: null,
    creator: { id: USER_ID, firstName: "Ada", lastName: "Admin" },
    ...over,
  }
}

type FakeState = {
  branches?: Record<string, { companyId: string; isActive: boolean; deletedAt: Date | null }>
  suppliers?: Record<string, { companyId: string; isActive: boolean }>
  assets?: Array<ReturnType<typeof serializedRow>>
  createError?: unknown
  created?: Record<string, unknown> | null
  updated?: Record<string, unknown> | null
  lastFindManyWhere?: unknown
  lastCountWhere?: unknown
}

function fakeDb(state: FakeState = {}): PrismaClient {
  const assets = state.assets ?? []
  return {
    branch: {
      findFirst: async ({ where }: { where: { id: string; companyId: string; deletedAt: null; isActive: boolean } }) => {
        const row = state.branches?.[where.id]
        if (!row) return null
        if (row.companyId !== where.companyId) return null
        if (row.deletedAt !== null) return null
        if (!row.isActive) return null
        return { id: where.id }
      },
      findMany: async ({ where }: { where: { companyId: string } }) => {
        return Object.entries(state.branches ?? {})
          .filter(([, b]) => b.companyId === where.companyId && b.isActive && !b.deletedAt)
          .map(([id]) => ({ id, name: id }))
      },
    },
    supplier: {
      findFirst: async ({ where }: { where: { id: string; companyId: string; isActive: boolean } }) => {
        const row = state.suppliers?.[where.id]
        if (!row) return null
        if (row.companyId !== where.companyId) return null
        if (!row.isActive) return null
        return { id: where.id }
      },
      findMany: async () => [],
    },
    asset: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        state.lastFindManyWhere = where
        return assets.filter((a) => {
          if (where.companyId && a.companyId !== where.companyId) return false
          if (where.deletedAt === null && a.deletedAt) return false
          return true
        })
      },
      count: async ({ where }: { where: Record<string, unknown> }) => {
        state.lastCountWhere = where
        return assets.filter((a) => !(where.deletedAt === null && a.deletedAt)).length
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id) {
          const row = assets.find((a) => a.id === where.id)
          if (!row) return null
          if (where.companyId && row.companyId !== where.companyId) return null
          if (where.deletedAt === null && row.deletedAt) return null
          return row
        }
        if (typeof where.code === "string") {
          return assets.find((a) => a.companyId === where.companyId && a.code === where.code) ?? null
        }
        if (where.code && typeof where.code === "object" && "startsWith" in (where.code as object)) {
          const prefix = (where.code as { startsWith: string }).startsWith
          const matches = assets
            .filter((a) => a.companyId === where.companyId && a.code.startsWith(prefix))
            .sort((a, b) => b.code.localeCompare(a.code))
          return matches[0] ?? null
        }
        return assets[0] ?? null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (state.createError) throw state.createError
        const row = serializedRow({
          ...data,
          branch: { id: data.branchId, name: "HQ" },
          supplier: data.supplierId ? { id: data.supplierId, name: "Vendor" } : null,
        })
        state.created = row
        assets.push(row)
        return row
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (state.createError) throw state.createError
        const current = assets[0] ?? serializedRow()
        const row = serializedRow({ ...current, ...data, deletedAt: (data.deletedAt as Date) ?? current.deletedAt })
        state.updated = row
        return row
      },
    },
  } as unknown as PrismaClient
}

const validCreate = {
  branchId: BRANCH_A,
  code: "AST-2026-00001",
  name: "Dump truck 01",
  type: "VEHICLE" as const,
  ownership: "COMPANY" as const,
  serialNumber: null,
  locationDetail: null,
  supplierId: null,
  acquiredAt: null,
}

describe("asset enums", () => {
  it("exposes Phase 1 type, status, and ownership values only", () => {
    expect(ASSET_TYPES).toEqual(["VEHICLE", "MACHINE"])
    expect(ASSET_STATUSES).toEqual(["REGISTERED", "ACTIVE", "IDLE", "RETIRED", "DISPOSED"])
    expect(ASSET_OWNERSHIPS).toEqual(["COMPANY", "LEASED", "EXTERNAL"])
  })

  it("rejects IT / EQUIPMENT / BUILDING types and ops statuses", () => {
    expect(createAssetSchema.safeParse({ ...validCreate, type: "IT" }).success).toBe(false)
    expect(createAssetSchema.safeParse({ ...validCreate, status: "under_maintenance" }).success).toBe(false)
    expect(createAssetSchema.safeParse({ ...validCreate, ownership: "OWNED" }).success).toBe(false)
  })

  it("accepts COMPANY, LEASED, and EXTERNAL", () => {
    for (const ownership of ASSET_OWNERSHIPS) {
      expect(createAssetSchema.safeParse({ ...validCreate, ownership }).success).toBe(true)
    }
  })
})

describe("asset code helper", () => {
  it("formats sequential AST-{year}-{#####} codes", () => {
    expect(formatAssetCode(1, 2026)).toBe("AST-2026-00001")
    expect(parseAssetCodeSeq("AST-2026-00007", "AST-2026-")).toBe(7)
    expect(parseAssetCodeSeq("MCH-001", "AST-2026-")).toBe(0)
  })
})

describe("listAssets / getAsset", () => {
  it("lists live rows and excludes deletedAt", async () => {
    const state: FakeState = {
      assets: [
        serializedRow(),
        serializedRow({ id: "dead", deletedAt: now, code: "AST-2026-00099" }),
      ],
    }
    const db = fakeDb(state)
    const result = await listAssets(db, { companyId: CID, roles: adminRoles })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].code).toBe("AST-2026-00001")
    expect(state.lastFindManyWhere).toMatchObject({ companyId: CID, deletedAt: null })
    expect(state.lastCountWhere).toMatchObject({ deletedAt: null })
  })

  it("returns 404 for a soft-deleted id", async () => {
    const db = fakeDb({
      assets: [serializedRow({ deletedAt: now })],
    })
    await expect(getAsset(db, { companyId: CID, roles: adminRoles, id: ASSET_ID })).rejects.toBeInstanceOf(
      NotFoundError
    )
  })

  it("forbids list without assets permission", async () => {
    await expect(listAssets(fakeDb(), { companyId: CID, roles: noPermRoles })).rejects.toBeInstanceOf(
      ForbiddenError
    )
  })
})

describe("createAsset", () => {
  it("creates a register row on the happy path", async () => {
    const state: FakeState = {
      branches: { [BRANCH_A]: { companyId: CID, isActive: true, deletedAt: null } },
    }
    const db = fakeDb(state)
    const result = await createAsset(db, {
      companyId: CID,
      roles: adminRoles,
      userId: USER_ID,
      input: validCreate,
    })
    expect(result.data.code).toBe("AST-2026-00001")
    expect(result.data.status).toBe("REGISTERED")
    expect(result.data.type).toBe("VEHICLE")
    expect(state.created).toMatchObject({ companyId: CID, branchId: BRANCH_A })
  })

  it("rejects a duplicate code in the same company", async () => {
    const db = fakeDb({
      branches: { [BRANCH_A]: { companyId: CID, isActive: true, deletedAt: null } },
      createError: new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
      }),
    })
    await expect(
      createAsset(db, { companyId: CID, roles: adminRoles, userId: USER_ID, input: validCreate })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("allows the same code in another company (unique is per company)", async () => {
    const db = fakeDb({
      branches: { [BRANCH_A]: { companyId: CID_B, isActive: true, deletedAt: null } },
    })
    const result = await createAsset(db, {
      companyId: CID_B,
      roles: adminRoles,
      userId: USER_ID,
      input: validCreate,
    })
    expect(result.data.companyId).toBe(CID_B)
  })

  it("rejects an invalid or inactive branch", async () => {
    const db = fakeDb({
      branches: { [BRANCH_A]: { companyId: CID, isActive: false, deletedAt: null } },
    })
    await expect(
      createAsset(db, { companyId: CID, roles: adminRoles, userId: USER_ID, input: validCreate })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("rejects a supplier from another company or an inactive supplier", async () => {
    const dbWrongCompany = fakeDb({
      branches: { [BRANCH_A]: { companyId: CID, isActive: true, deletedAt: null } },
      suppliers: { [SUPPLIER_A]: { companyId: CID_B, isActive: true } },
    })
    await expect(
      createAsset(dbWrongCompany, {
        companyId: CID,
        roles: adminRoles,
        userId: USER_ID,
        input: { ...validCreate, supplierId: SUPPLIER_A },
      })
    ).rejects.toBeInstanceOf(ValidationError)

    const dbInactive = fakeDb({
      branches: { [BRANCH_A]: { companyId: CID, isActive: true, deletedAt: null } },
      suppliers: { [SUPPLIER_A]: { companyId: CID, isActive: false } },
    })
    await expect(
      createAsset(dbInactive, {
        companyId: CID,
        roles: adminRoles,
        userId: USER_ID,
        input: { ...validCreate, supplierId: SUPPLIER_A },
      })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("forbids create without assets permission", async () => {
    await expect(
      createAsset(fakeDb(), { companyId: CID, roles: viewerRoles, userId: USER_ID, input: validCreate })
    ).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      createAsset(fakeDb(), { companyId: CID, roles: technicianRoles, userId: USER_ID, input: validCreate })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("forbids a non-admin from using a foreign branch", async () => {
    const db = fakeDb({
      branches: { [BRANCH_B]: { companyId: CID, isActive: true, deletedAt: null } },
    })
    await expect(
      createAsset(db, {
        companyId: CID,
        roles: managerRoles,
        userId: USER_ID,
        input: { ...validCreate, branchId: BRANCH_B },
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe("updateAsset / deleteAsset", () => {
  it("updates status through any Phase 1 lifecycle value", async () => {
    const db = fakeDb({
      assets: [serializedRow()],
    })
    const result = await updateAsset(db, {
      companyId: CID,
      roles: managerRoles,
      id: ASSET_ID,
      input: { status: "ACTIVE" },
    })
    expect(result.data.status).toBe("ACTIVE")
  })

  it("soft-deletes with deletedAt and isActive=false", async () => {
    const state: FakeState = { assets: [serializedRow()] }
    const db = fakeDb(state)
    const result = await deleteAsset(db, { companyId: CID, roles: adminRoles, id: ASSET_ID })
    expect(result.success).toBe(true)
    expect(state.updated).toMatchObject({ isActive: false })
    expect((state.updated as { deletedAt: Date }).deletedAt).toBeInstanceOf(Date)
  })

  it("forbids delete for Manager", async () => {
    await expect(
      deleteAsset(fakeDb({ assets: [serializedRow()] }), {
        companyId: CID,
        roles: managerRoles,
        id: ASSET_ID,
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe("suggestNextAssetCode", () => {
  it("suggests the next sequential code and retries when occupied", async () => {
    const db = fakeDb({
      assets: [serializedRow({ code: "AST-2026-00001" })],
    })
    const result = await suggestNextAssetCode(db, { companyId: CID, roles: adminRoles })
    expect(result.data.code).toMatch(/^AST-\d{4}-\d{5}$/)
    expect(result.data.code).not.toBe("AST-2026-00001")
  })
})
