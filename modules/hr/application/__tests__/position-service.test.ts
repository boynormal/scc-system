import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import {
  MAX_POSITION_DEPTH,
  buildPositionTree,
  createPosition,
  deletePosition,
  getPosition,
  listPositionOptions,
  listPositions,
  updatePosition,
  type PositionRow,
} from "@/modules/hr/application/position-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "22222222-2222-2222-2222-222222222222"
const DEPT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const DEPT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const POS_ROOT = "10000000-0000-0000-0000-000000000001"
const POS_CHILD = "10000000-0000-0000-0000-000000000002"
const POS_GRAND = "10000000-0000-0000-0000-000000000003"
const POS_OTHER_BRANCH = "10000000-0000-0000-0000-0000000000b1"
const NEW_ID = "10000000-0000-0000-0000-00000000000f"

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null },
]
const managerA: UserRole[] = [
  { branchId: BRANCH_A, branchName: "A", roleName: "Manager", permissions: null },
]
const viewerA: UserRole[] = [
  { branchId: BRANCH_A, branchName: "A", roleName: "Viewer", permissions: null },
]
const managerB: UserRole[] = [
  { branchId: BRANCH_B, branchName: "B", roleName: "Manager", permissions: null },
]
const noHrRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "A", roleName: "Custom", permissions: { machines: ["read"] } },
]

function asDb(db: object): PrismaClient {
  return db as unknown as PrismaClient
}

type RawPos = {
  id: string
  branchId: string
  parentId: string | null
  departmentId: string | null
  code: string | null
  name: string
  sortOrder: number
  headcount: number
  responsibilities: string | null
  isActive: boolean
  department: { id: string; name: string; code: string | null } | null
}

function pos(over: Partial<RawPos> & { id: string; name: string }): RawPos {
  return {
    branchId: BRANCH_A,
    parentId: null,
    departmentId: null,
    code: null,
    sortOrder: 0,
    headcount: 1,
    responsibilities: null,
    isActive: true,
    department: null,
    ...over,
  }
}

/** ห่วงโซ่ id คนละช่วงกับ POS_* เพื่อไม่ให้ชนกันโดยไม่ตั้งใจ */
function chainId(i: number): string {
  return `20000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`
}

function buildChain(length: number): RawPos[] {
  return Array.from({ length }, (_, i) =>
    pos({ id: chainId(i), name: `ชั้น ${i}`, parentId: i === 0 ? null : chainId(i - 1) })
  )
}

function createDb(opts: {
  branch?: { id: string; code: string; name: string } | null
  positions?: RawPos[]
  people?: { positionId: string | null }[]
  department?: { id: string; branchId: string } | null
  childCount?: number
  personnelCount?: number
  createdId?: string
}) {
  const positions = opts.positions ?? []
  return {
    branch: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          opts.branch === undefined ? { id: BRANCH_A, code: "A", name: "สาขา A" } : opts.branch
        ),
    },
    department: {
      findFirst: vi.fn().mockResolvedValue(opts.department === undefined ? null : opts.department),
    },
    position: {
      findMany: vi.fn(async (args: { where?: { isActive?: boolean } }) => {
        const wantActive = args?.where?.isActive
        const rows = wantActive === true ? positions.filter((p) => p.isActive) : positions
        return rows.map((p) => ({ ...p }))
      }),
      findFirst: vi.fn(async (args: { where?: { id?: string; code?: string } }) => {
        const id = args?.where?.id
        if (typeof id === "string") return positions.find((p) => p.id === id) ?? null
        const code = args?.where?.code
        if (typeof code === "string") return positions.find((p) => p.code === code) ?? null
        return null
      }),
      create: vi.fn(async (args: { data: Record<string, unknown> }) =>
        pos({
          id: opts.createdId ?? NEW_ID,
          name: String(args.data.name),
          branchId: String(args.data.branchId),
          parentId: (args.data.parentId as string | null) ?? null,
          departmentId: (args.data.departmentId as string | null) ?? null,
          code: (args.data.code as string | null) ?? null,
          headcount: Number(args.data.headcount ?? 1),
          sortOrder: Number(args.data.sortOrder ?? 0),
          responsibilities: (args.data.responsibilities as string | null) ?? null,
        })
      ),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = positions.find((p) => p.id === args.where.id)
        const next = { ...(existing ?? pos({ id: args.where.id, name: "x" })) }
        if (args.data.name !== undefined) next.name = String(args.data.name)
        if (args.data.code !== undefined) next.code = args.data.code as string | null
        if (args.data.headcount !== undefined) next.headcount = Number(args.data.headcount)
        if (args.data.isActive !== undefined) next.isActive = Boolean(args.data.isActive)
        const parent = args.data.parent as { connect?: { id: string }; disconnect?: true } | undefined
        if (parent) next.parentId = parent.connect ? parent.connect.id : null
        const dept = args.data.department as
          | { connect?: { id: string }; disconnect?: true }
          | undefined
        if (dept) next.departmentId = dept.connect ? dept.connect.id : null
        return next
      }),
      delete: vi.fn(async (args: { where: { id: string } }) => ({ id: args.where.id })),
      count: vi.fn().mockResolvedValue(opts.childCount ?? 0),
    },
    personnel: {
      findMany: vi.fn().mockResolvedValue(opts.people ?? []),
      count: vi.fn().mockResolvedValue(opts.personnelCount ?? 0),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe("buildPositionTree", () => {
  const row = (over: Partial<PositionRow> & { id: string; name: string }): PositionRow => ({
    branchId: BRANCH_A,
    parentId: null,
    departmentId: null,
    department: null,
    code: null,
    sortOrder: 0,
    headcount: 1,
    responsibilities: null,
    isActive: true,
    occupantCount: 0,
    vacancy: 1,
    ...over,
  })

  it("nests children under their parent and stamps depth", () => {
    const tree = buildPositionTree([
      row({ id: POS_CHILD, name: "ผู้จัดการ", parentId: POS_ROOT }),
      row({ id: POS_ROOT, name: "กรรมการผู้จัดการ" }),
      row({ id: POS_GRAND, name: "หัวหน้า", parentId: POS_CHILD }),
    ])

    expect(tree).toHaveLength(1)
    expect(tree[0]!.id).toBe(POS_ROOT)
    expect(tree[0]!.depth).toBe(0)
    expect(tree[0]!.children[0]!.id).toBe(POS_CHILD)
    expect(tree[0]!.children[0]!.depth).toBe(1)
    expect(tree[0]!.children[0]!.children[0]!.depth).toBe(2)
  })

  it("promotes an orphan to root when its parent is not in the set", () => {
    const tree = buildPositionTree([row({ id: POS_CHILD, name: "ลูกกำพร้า", parentId: POS_ROOT })])

    expect(tree).toHaveLength(1)
    expect(tree[0]!.id).toBe(POS_CHILD)
    expect(tree[0]!.depth).toBe(0)
  })

  it("keeps every row reachable even when the data contains a parent cycle", () => {
    const tree = buildPositionTree([
      row({ id: POS_ROOT, name: "A", parentId: POS_CHILD }),
      row({ id: POS_CHILD, name: "B", parentId: POS_ROOT }),
    ])

    const seen: string[] = []
    const walk = (nodes: typeof tree) => {
      for (const n of nodes) {
        seen.push(n.id)
        walk(n.children)
      }
    }
    walk(tree)
    expect(new Set(seen).size).toBeGreaterThan(0)
    expect(seen.length).toBeLessThanOrEqual(2)
  })

  it("orders siblings by sortOrder then name", () => {
    const tree = buildPositionTree([
      row({ id: POS_GRAND, name: "ก", sortOrder: 5 }),
      row({ id: POS_CHILD, name: "ข", sortOrder: 1 }),
      row({ id: POS_ROOT, name: "ก", sortOrder: 1 }),
    ])

    expect(tree.map((n) => n.id)).toEqual([POS_ROOT, POS_CHILD, POS_GRAND])
  })
})

describe("listPositions", () => {
  it("returns the tree with occupant counts and vacancy totals", async () => {
    const db = createDb({
      positions: [
        pos({ id: POS_ROOT, name: "กรรมการผู้จัดการ", headcount: 1 }),
        pos({ id: POS_CHILD, name: "ผู้จัดการฝ่ายผลิต", parentId: POS_ROOT, headcount: 3 }),
      ],
      people: [{ positionId: POS_ROOT }, { positionId: POS_CHILD }],
    })

    const { data } = await listPositions(asDb(db), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
    })

    expect(data.tree).toHaveLength(1)
    expect(data.tree[0]!.occupantCount).toBe(1)
    expect(data.tree[0]!.vacancy).toBe(0)
    expect(data.tree[0]!.children[0]!.occupantCount).toBe(1)
    expect(data.tree[0]!.children[0]!.vacancy).toBe(2)
    expect(data.totals).toEqual({ positions: 2, headcount: 4, occupied: 2, vacancy: 2 })
  })

  it("hides inactive positions unless includeInactive is set", async () => {
    const positions = [
      pos({ id: POS_ROOT, name: "root" }),
      pos({ id: POS_CHILD, name: "ปิดแล้ว", isActive: false }),
    ]

    const active = await listPositions(asDb(createDb({ positions })), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
    })
    expect(active.data.totals.positions).toBe(1)

    const all = await listPositions(asDb(createDb({ positions })), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
      includeInactive: true,
    })
    expect(all.data.totals.positions).toBe(2)
  })

  it("counts only active, non-deleted personnel as occupants", async () => {
    const db = createDb({
      positions: [pos({ id: POS_ROOT, name: "root", headcount: 2 })],
      people: [{ positionId: POS_ROOT }],
    })

    await listPositions(asDb(db), { companyId: CID, roles: managerA, branchId: BRANCH_A })

    const where = db.personnel.findMany.mock.calls[0]![0].where
    expect(where.deletedAt).toBeNull()
    expect(where.isActive).toBe(true)
  })

  it("rejects a caller with no HR read at all", async () => {
    await expect(
      listPositions(asDb(createDb({})), {
        companyId: CID,
        roles: noHrRoles,
        branchId: BRANCH_A,
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("returns 403 when a branch-restricted user asks for another branch", async () => {
    const db = createDb({ branch: { id: BRANCH_A, code: "A", name: "สาขา A" } })

    await expect(
      listPositions(asDb(db), { companyId: CID, roles: managerB, branchId: BRANCH_A })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("allows Admin on a branch they are not assigned to", async () => {
    const db = createDb({
      branch: { id: BRANCH_B, code: "B", name: "สาขา B" },
      positions: [pos({ id: POS_OTHER_BRANCH, name: "root", branchId: BRANCH_B })],
    })

    const { data } = await listPositions(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_B,
    })
    expect(data.branch.id).toBe(BRANCH_B)
  })

  it("rejects an invalid branch id before touching positions", async () => {
    const db = createDb({})

    await expect(
      listPositions(asDb(db), { companyId: CID, roles: managerA, branchId: "not-a-uuid" })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(db.position.findMany).not.toHaveBeenCalled()
  })

  it("lets a Viewer read positions through hr_personnel read", async () => {
    const db = createDb({ positions: [pos({ id: POS_ROOT, name: "root" })] })

    const { data } = await listPositions(asDb(db), {
      companyId: CID,
      roles: viewerA,
      branchId: BRANCH_A,
    })
    expect(data.totals.positions).toBe(1)
  })
})

describe("listPositionOptions", () => {
  it("flattens the tree with depth for indented pickers", async () => {
    const db = createDb({
      positions: [
        pos({ id: POS_ROOT, name: "root" }),
        pos({ id: POS_CHILD, name: "child", parentId: POS_ROOT }),
      ],
    })

    const { data } = await listPositionOptions(asDb(db), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
    })

    expect(data).toEqual([
      { id: POS_ROOT, name: "root", code: null, parentId: null, depth: 0 },
      { id: POS_CHILD, name: "child", code: null, parentId: POS_ROOT, depth: 1 },
    ])
  })
})

describe("createPosition", () => {
  const input = { branchId: BRANCH_A, name: "ผู้จัดการฝ่ายผลิต" } as const

  it("creates a root position and writes an audit row", async () => {
    const db = createDb({})

    const { data } = await createPosition(asDb(db), {
      companyId: CID,
      roles: managerA,
      userId: "user-1",
      input: { ...input, code: null, parentId: null, departmentId: null, responsibilities: null },
    })

    expect(data.id).toBe(NEW_ID)
    expect(data.branchId).toBe(BRANCH_A)
    expect(db.auditLog.create).toHaveBeenCalledTimes(1)
    const audit = db.auditLog.create.mock.calls[0]![0].data
    expect(audit.tableName).toBe("positions")
    expect(audit.action).toBe("create")
    expect(audit.newValues.event).toBe("POSITION_CREATE")
    expect(audit.newValues.branchId).toBe(BRANCH_A)
  })

  it("rejects a parent that lives on another branch", async () => {
    const db = createDb({
      positions: [pos({ id: POS_OTHER_BRANCH, name: "หัวหน้าสาขาอื่น", branchId: BRANCH_B })],
    })

    await expect(
      createPosition(asDb(db), {
        companyId: CID,
        roles: managerA,
        input: {
          ...input,
          code: null,
          departmentId: null,
          responsibilities: null,
          parentId: POS_OTHER_BRANCH,
        },
      })
    ).rejects.toThrow("ตำแหน่งหัวหน้าต้องอยู่สาขาเดียวกัน")
    expect(db.position.create).not.toHaveBeenCalled()
  })

  it("rejects a department that lives on another branch", async () => {
    const db = createDb({ department: { id: DEPT_B, branchId: BRANCH_B } })

    await expect(
      createPosition(asDb(db), {
        companyId: CID,
        roles: managerA,
        input: {
          ...input,
          code: null,
          parentId: null,
          responsibilities: null,
          departmentId: DEPT_B,
        },
      })
    ).rejects.toThrow("แผนกต้องอยู่สาขาเดียวกับตำแหน่ง")
  })

  it("accepts a department on the same branch", async () => {
    const db = createDb({ department: { id: DEPT_A, branchId: BRANCH_A } })

    await createPosition(asDb(db), {
      companyId: CID,
      roles: managerA,
      input: {
        ...input,
        code: null,
        parentId: null,
        responsibilities: null,
        departmentId: DEPT_A,
      },
    })
    expect(db.position.create).toHaveBeenCalledTimes(1)
  })

  it("rejects a duplicate code inside the same branch", async () => {
    const db = createDb({ positions: [pos({ id: POS_ROOT, name: "root", code: "MD" })] })

    await expect(
      createPosition(asDb(db), {
        companyId: CID,
        roles: managerA,
        input: {
          ...input,
          parentId: null,
          departmentId: null,
          responsibilities: null,
          code: "MD",
        },
      })
    ).rejects.toThrow("รหัสตำแหน่งซ้ำในสาขานี้")
  })

  it("rejects a chain deeper than the allowed limit", async () => {
    const chain = buildChain(MAX_POSITION_DEPTH)
    const db = createDb({ positions: chain })

    await expect(
      createPosition(asDb(db), {
        companyId: CID,
        roles: managerA,
        input: {
          ...input,
          code: null,
          departmentId: null,
          responsibilities: null,
          parentId: chain[MAX_POSITION_DEPTH - 1]!.id,
        },
      })
    ).rejects.toThrow(`สายบังคับบัญชาลึกเกิน ${MAX_POSITION_DEPTH} ชั้น`)
  })

  it("is Forbidden for a Viewer", async () => {
    await expect(
      createPosition(asDb(createDb({})), {
        companyId: CID,
        roles: viewerA,
        input: { ...input, code: null, parentId: null, departmentId: null, responsibilities: null },
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("is Forbidden when the writer has no rights on the target branch", async () => {
    const db = createDb({ branch: { id: BRANCH_A, code: "A", name: "สาขา A" } })

    await expect(
      createPosition(asDb(db), {
        companyId: CID,
        roles: managerB,
        input: { ...input, code: null, parentId: null, departmentId: null, responsibilities: null },
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe("updatePosition", () => {
  it("moves a position under a new parent and logs POSITION_MOVE", async () => {
    const db = createDb({
      positions: [
        pos({ id: POS_ROOT, name: "root" }),
        pos({ id: POS_CHILD, name: "child" }),
        pos({ id: POS_GRAND, name: "grand" }),
      ],
    })

    await updatePosition(asDb(db), {
      companyId: CID,
      roles: managerA,
      userId: "user-1",
      id: POS_GRAND,
      input: { parentId: POS_ROOT },
    })

    const audit = db.auditLog.create.mock.calls[0]![0].data
    expect(audit.newValues.event).toBe("POSITION_MOVE")
    expect(audit.oldValues.parentId).toBeNull()
    expect(audit.newValues.parentId).toBe(POS_ROOT)
  })

  it("logs POSITION_UPDATE when the parent did not change", async () => {
    const db = createDb({ positions: [pos({ id: POS_ROOT, name: "root" })] })

    await updatePosition(asDb(db), {
      companyId: CID,
      roles: managerA,
      id: POS_ROOT,
      input: { name: "ประธานกรรมการ" },
    })

    expect(db.auditLog.create.mock.calls[0]![0].data.newValues.event).toBe("POSITION_UPDATE")
  })

  it("refuses to make a position its own parent", async () => {
    const db = createDb({ positions: [pos({ id: POS_ROOT, name: "root" })] })

    await expect(
      updatePosition(asDb(db), {
        companyId: CID,
        roles: managerA,
        id: POS_ROOT,
        input: { parentId: POS_ROOT },
      })
    ).rejects.toThrow("ตำแหน่งเป็นหัวหน้าของตัวเองไม่ได้")
  })

  it("refuses a move that would create a cycle", async () => {
    const db = createDb({
      positions: [
        pos({ id: POS_ROOT, name: "root" }),
        pos({ id: POS_CHILD, name: "child", parentId: POS_ROOT }),
        pos({ id: POS_GRAND, name: "grand", parentId: POS_CHILD }),
      ],
    })

    await expect(
      updatePosition(asDb(db), {
        companyId: CID,
        roles: managerA,
        id: POS_ROOT,
        input: { parentId: POS_GRAND },
      })
    ).rejects.toThrow("ย้ายแล้วสายบังคับบัญชาจะวนกลับมาที่ตัวเอง")
    expect(db.position.update).not.toHaveBeenCalled()
  })

  it("counts the moved subtree height against the depth limit", async () => {
    const chain = buildChain(MAX_POSITION_DEPTH - 1)
    const movedRoot = pos({ id: POS_CHILD, name: "ทีมย่อย" })
    const movedChild = pos({ id: POS_GRAND, name: "ลูกทีม", parentId: POS_CHILD })
    const db = createDb({ positions: [...chain, movedRoot, movedChild] })

    await expect(
      updatePosition(asDb(db), {
        companyId: CID,
        roles: managerA,
        id: POS_CHILD,
        input: { parentId: chain[chain.length - 1]!.id },
      })
    ).rejects.toThrow(`สายบังคับบัญชาลึกเกิน ${MAX_POSITION_DEPTH} ชั้น`)
  })

  it("rejects moving under a parent on another branch", async () => {
    const db = createDb({
      positions: [
        pos({ id: POS_ROOT, name: "root" }),
        pos({ id: POS_OTHER_BRANCH, name: "อื่น", branchId: BRANCH_B }),
      ],
    })

    await expect(
      updatePosition(asDb(db), {
        companyId: CID,
        roles: managerA,
        id: POS_ROOT,
        input: { parentId: POS_OTHER_BRANCH },
      })
    ).rejects.toThrow("ตำแหน่งหัวหน้าต้องอยู่สาขาเดียวกัน")
  })

  it("rejects a department from another branch", async () => {
    const db = createDb({
      positions: [pos({ id: POS_ROOT, name: "root" })],
      department: { id: DEPT_B, branchId: BRANCH_B },
    })

    await expect(
      updatePosition(asDb(db), {
        companyId: CID,
        roles: managerA,
        id: POS_ROOT,
        input: { departmentId: DEPT_B },
      })
    ).rejects.toThrow("แผนกต้องอยู่สาขาเดียวกับตำแหน่ง")
  })

  it("is NotFound for an id outside the company", async () => {
    const db = createDb({ positions: [] })

    await expect(
      updatePosition(asDb(db), {
        companyId: CID,
        roles: managerA,
        id: POS_ROOT,
        input: { name: "x" },
      })
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("is Forbidden when the writer has no rights on the position branch", async () => {
    const db = createDb({ positions: [pos({ id: POS_ROOT, name: "root" })] })

    await expect(
      updatePosition(asDb(db), {
        companyId: CID,
        roles: managerB,
        id: POS_ROOT,
        input: { name: "x" },
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe("deletePosition", () => {
  it("hard deletes a leaf that nobody points at", async () => {
    const db = createDb({
      positions: [pos({ id: POS_ROOT, name: "root" })],
      childCount: 0,
      personnelCount: 0,
    })

    const { data } = await deletePosition(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      id: POS_ROOT,
    })

    expect(data).toEqual({ id: POS_ROOT, deactivated: false })
    expect(db.position.delete).toHaveBeenCalledTimes(1)
    expect(db.auditLog.create.mock.calls[0]![0].data.newValues.event).toBe("POSITION_DELETE")
  })

  it("deactivates instead of deleting when children exist", async () => {
    const db = createDb({
      positions: [pos({ id: POS_ROOT, name: "root" })],
      childCount: 2,
    })

    const { data } = await deletePosition(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      id: POS_ROOT,
    })

    expect(data).toEqual({ id: POS_ROOT, deactivated: true })
    expect(db.position.delete).not.toHaveBeenCalled()
    expect(db.position.update).toHaveBeenCalledWith({
      where: { id: POS_ROOT },
      data: { isActive: false },
    })
    expect(db.auditLog.create.mock.calls[0]![0].data.newValues.event).toBe("POSITION_DEACTIVATE")
  })

  it("deactivates when personnel still point at the position", async () => {
    const db = createDb({
      positions: [pos({ id: POS_ROOT, name: "root" })],
      personnelCount: 1,
    })

    const { data } = await deletePosition(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      id: POS_ROOT,
    })

    expect(data.deactivated).toBe(true)
    expect(db.position.delete).not.toHaveBeenCalled()
  })

  it("counts soft-deleted personnel in the delete guard", async () => {
    const db = createDb({ positions: [pos({ id: POS_ROOT, name: "root" })] })

    await deletePosition(asDb(db), { companyId: CID, roles: adminRoles, id: POS_ROOT })

    expect(db.personnel.count).toHaveBeenCalledWith({ where: { positionId: POS_ROOT } })
  })

  it("is Forbidden for a Manager without delete rights", async () => {
    await expect(
      deletePosition(asDb(createDb({})), { companyId: CID, roles: managerA, id: POS_ROOT })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe("getPosition", () => {
  it("returns the row with its parent label", async () => {
    const db = createDb({ positions: [pos({ id: POS_ROOT, name: "root" })] })
    db.position.findFirst = vi.fn().mockResolvedValue({
      ...pos({ id: POS_CHILD, name: "child", parentId: POS_ROOT }),
      parent: { id: POS_ROOT, name: "root" },
    })

    const { data } = await getPosition(asDb(db), {
      companyId: CID,
      roles: managerA,
      id: POS_CHILD,
    })

    expect(data.parent).toEqual({ id: POS_ROOT, name: "root" })
  })

  it("is NotFound when the row is outside the company", async () => {
    const db = createDb({})
    db.position.findFirst = vi.fn().mockResolvedValue(null)

    await expect(
      getPosition(asDb(db), { companyId: CID, roles: managerA, id: POS_ROOT })
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})
