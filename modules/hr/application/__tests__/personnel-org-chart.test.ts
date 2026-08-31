import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import {
  buildOrgChartTree,
  flattenOrgChart,
  getPersonnelOrgChart,
  matchesOrgChartSearch,
  parseResponsibilities,
  type OrgChartOccupant,
} from "@/modules/hr/application/personnel-org-chart"

const CID = "00000000-0000-0000-0000-0000000000cc"
const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "22222222-2222-2222-2222-222222222222"
const POS_ROOT = "10000000-0000-0000-0000-000000000001"
const POS_CHILD = "10000000-0000-0000-0000-000000000002"
const POS_GRAND = "10000000-0000-0000-0000-000000000003"
const POS_SECOND_ROOT = "10000000-0000-0000-0000-000000000004"
const PERSON_1 = "55555555-5555-5555-5555-555555555555"
const PERSON_2 = "66666666-6666-6666-6666-666666666666"
const PERSON_3 = "77777777-7777-7777-7777-777777777777"

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null },
]
const managerA: UserRole[] = [
  { branchId: BRANCH_A, branchName: "A", roleName: "Manager", permissions: null },
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

type PosRaw = {
  id: string
  name: string
  code: string | null
  parentId: string | null
  sortOrder: number
  headcount: number
  responsibilities: string | null
  isActive: boolean
  department: { id: string; name: string; code: string | null } | null
}

function pos(over: Partial<PosRaw> & { id: string; name: string }): PosRaw {
  return {
    code: null,
    parentId: null,
    sortOrder: 0,
    headcount: 1,
    responsibilities: null,
    isActive: true,
    department: null,
    ...over,
  }
}

function person(over: {
  id?: string
  displayName?: string
  rosterNo?: string
  jobGroup?: string | null
  isActive?: boolean
  positionId?: string | null
}) {
  return {
    id: over.id ?? PERSON_1,
    rosterNo: over.rosterNo ?? "001",
    displayName: over.displayName ?? "สมชาย",
    jobGroup: over.jobGroup === undefined ? "ผลิต" : over.jobGroup,
    isActive: over.isActive ?? true,
    positionId: over.positionId === undefined ? null : over.positionId,
  }
}

function createDb(opts: {
  branch?: { id: string; code: string; name: string } | null
  positions?: PosRaw[]
  people?: ReturnType<typeof person>[]
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
    position: {
      findMany: vi.fn(async (args: { where?: { isActive?: boolean } }) => {
        const wantActive = args?.where?.isActive
        const rows = wantActive === true ? positions.filter((p) => p.isActive) : positions
        return rows.map((p) => ({ ...p }))
      }),
    },
    personnel: {
      findMany: vi.fn().mockResolvedValue(opts.people ?? []),
    },
  }
}

const occupant = (over: Partial<OrgChartOccupant> = {}): OrgChartOccupant => ({
  id: PERSON_1,
  rosterNo: "001",
  displayName: "สมชาย",
  jobGroup: "ผลิต",
  isActive: true,
  ...over,
})

describe("parseResponsibilities", () => {
  it("splits on newlines and drops blank lines", () => {
    expect(parseResponsibilities("กำกับสายผลิต\n\n  รายงานผลรายวัน  \n")).toEqual([
      "กำกับสายผลิต",
      "รายงานผลรายวัน",
    ])
  })

  it("returns an empty list for null", () => {
    expect(parseResponsibilities(null)).toEqual([])
  })
})

describe("buildOrgChartTree", () => {
  it("nests children, stamps depth, and counts subtree size", () => {
    const roots = buildOrgChartTree(
      [
        pos({ id: POS_GRAND, name: "หัวหน้างาน", parentId: POS_CHILD }),
        pos({ id: POS_ROOT, name: "กรรมการผู้จัดการ" }),
        pos({ id: POS_CHILD, name: "ผู้จัดการ", parentId: POS_ROOT }),
      ],
      new Map()
    )

    expect(roots).toHaveLength(1)
    expect(roots[0]!.subtreeSize).toBe(3)
    expect(roots[0]!.children[0]!.depth).toBe(1)
    expect(roots[0]!.children[0]!.children[0]!.depth).toBe(2)
    expect(roots[0]!.children[0]!.children[0]!.subtreeSize).toBe(1)
  })

  it("keeps several roots side by side", () => {
    const roots = buildOrgChartTree(
      [
        pos({ id: POS_SECOND_ROOT, name: "ข", sortOrder: 2 }),
        pos({ id: POS_ROOT, name: "ก", sortOrder: 1 }),
      ],
      new Map()
    )

    expect(roots.map((r) => r.id)).toEqual([POS_ROOT, POS_SECOND_ROOT])
  })

  it("promotes an orphan whose parent was filtered out", () => {
    const roots = buildOrgChartTree(
      [pos({ id: POS_CHILD, name: "กิ่งกำพร้า", parentId: POS_ROOT })],
      new Map()
    )

    expect(roots).toHaveLength(1)
    expect(roots[0]!.id).toBe(POS_CHILD)
    expect(roots[0]!.depth).toBe(0)
  })

  it("keeps rows visible even when the data contains a parent cycle", () => {
    const roots = buildOrgChartTree(
      [
        pos({ id: POS_ROOT, name: "A", parentId: POS_CHILD }),
        pos({ id: POS_CHILD, name: "B", parentId: POS_ROOT }),
      ],
      new Map()
    )

    expect(flattenOrgChart(roots).map((n) => n.id).sort()).toEqual([POS_ROOT, POS_CHILD].sort())
  })

  it("computes vacancy from active occupants only", () => {
    const roots = buildOrgChartTree(
      [pos({ id: POS_ROOT, name: "ช่าง", headcount: 3 })],
      new Map([
        [
          POS_ROOT,
          [
            occupant({ id: PERSON_1 }),
            occupant({ id: PERSON_2, isActive: false }),
          ],
        ],
      ])
    )

    expect(roots[0]!.occupants).toHaveLength(2)
    expect(roots[0]!.vacancy).toBe(2)
  })

  it("never reports negative vacancy when overstaffed", () => {
    const roots = buildOrgChartTree(
      [pos({ id: POS_ROOT, name: "ช่าง", headcount: 1 })],
      new Map([[POS_ROOT, [occupant({ id: PERSON_1 }), occupant({ id: PERSON_2 })]]])
    )

    expect(roots[0]!.vacancy).toBe(0)
  })
})

describe("matchesOrgChartSearch", () => {
  const [node] = buildOrgChartTree(
    [pos({ id: POS_ROOT, name: "ผู้จัดการฝ่ายผลิต", code: "MGR" })],
    new Map([[POS_ROOT, [occupant({ displayName: "สมหญิง", rosterNo: "042" })]]])
  )

  it("matches on position name, code, and occupant fields", () => {
    expect(matchesOrgChartSearch(node!, "ผลิต")).toBe(true)
    expect(matchesOrgChartSearch(node!, "mgr")).toBe(true)
    expect(matchesOrgChartSearch(node!, "สมหญิง")).toBe(true)
    expect(matchesOrgChartSearch(node!, "042")).toBe(true)
  })

  it("returns false for a blank query or a miss", () => {
    expect(matchesOrgChartSearch(node!, "   ")).toBe(false)
    expect(matchesOrgChartSearch(node!, "ไม่มีจริง")).toBe(false)
  })
})

describe("getPersonnelOrgChart", () => {
  it("places people on their position and totals the branch", async () => {
    const db = createDb({
      positions: [
        pos({ id: POS_ROOT, name: "กรรมการผู้จัดการ", headcount: 1 }),
        pos({ id: POS_CHILD, name: "ผู้จัดการฝ่ายผลิต", parentId: POS_ROOT, headcount: 3 }),
      ],
      people: [
        person({ id: PERSON_1, positionId: POS_ROOT }),
        person({ id: PERSON_2, rosterNo: "002", positionId: POS_CHILD }),
        person({ id: PERSON_3, rosterNo: "003", displayName: "ยังไม่จัด" }),
      ],
    })

    const { data } = await getPersonnelOrgChart(asDb(db), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
    })

    expect(data.roots).toHaveLength(1)
    expect(data.roots[0]!.occupants.map((o) => o.id)).toEqual([PERSON_1])
    expect(data.roots[0]!.children[0]!.vacancy).toBe(2)
    expect(data.unplaced.map((o) => o.id)).toEqual([PERSON_3])
    expect(data.totals).toEqual({
      positions: 2,
      headcount: 4,
      occupied: 2,
      vacancy: 2,
      unplaced: 1,
    })
  })

  it("treats a person pointing at a filtered-out position as unplaced", async () => {
    const db = createDb({
      positions: [pos({ id: POS_ROOT, name: "เปิด" })],
      people: [person({ id: PERSON_1, positionId: POS_CHILD })],
    })

    const { data } = await getPersonnelOrgChart(asDb(db), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
    })

    expect(data.unplaced.map((o) => o.id)).toEqual([PERSON_1])
  })

  it("hides inactive positions by default and shows them on request", async () => {
    const positions = [
      pos({ id: POS_ROOT, name: "เปิด" }),
      pos({ id: POS_CHILD, name: "ปิดแล้ว", isActive: false }),
    ]

    const hidden = await getPersonnelOrgChart(asDb(createDb({ positions })), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
    })
    expect(hidden.data.totals.positions).toBe(1)

    const shown = await getPersonnelOrgChart(asDb(createDb({ positions })), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
      includeInactivePositions: true,
    })
    expect(shown.data.totals.positions).toBe(2)
  })

  it("keeps the tree intact when searching and only narrows the unplaced pile", async () => {
    const db = createDb({
      positions: [
        pos({ id: POS_ROOT, name: "กรรมการผู้จัดการ" }),
        pos({ id: POS_CHILD, name: "ผู้จัดการฝ่ายผลิต", parentId: POS_ROOT }),
      ],
      people: [
        person({ id: PERSON_1, displayName: "ไม่ตรงคำค้น" }),
        person({ id: PERSON_2, rosterNo: "002", displayName: "สมหญิง" }),
      ],
    })

    const { data } = await getPersonnelOrgChart(asDb(db), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
      search: "สมหญิง",
    })

    expect(data.totals.positions).toBe(2)
    expect(data.roots[0]!.children).toHaveLength(1)
    expect(data.unplaced.map((o) => o.id)).toEqual([PERSON_2])
  })

  it("defaults to active personnel and honours an explicit override", async () => {
    const db = createDb({ positions: [pos({ id: POS_ROOT, name: "root" })] })

    await getPersonnelOrgChart(asDb(db), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
    })
    const defaultWhere = db.personnel.findMany.mock.calls[0]![0].where
    expect(defaultWhere.deletedAt).toBeNull()
    expect(defaultWhere.AND.some((p: { isActive?: boolean }) => p.isActive === true)).toBe(true)

    const all = createDb({ positions: [pos({ id: POS_ROOT, name: "root" })] })
    await getPersonnelOrgChart(asDb(all), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
      isActive: null,
    })
    const allWhere = all.personnel.findMany.mock.calls[0]![0].where
    expect(allWhere.AND.some((p: { isActive?: boolean }) => "isActive" in p)).toBe(false)
  })

  it("scopes people by position branch, department branch, or home branch", async () => {
    const db = createDb({ positions: [] })

    await getPersonnelOrgChart(asDb(db), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
    })

    const scope = db.personnel.findMany.mock.calls[0]![0].where.AND[0].OR
    expect(scope).toEqual([
      { position: { branchId: BRANCH_A } },
      { department: { branchId: BRANCH_A } },
      { branchId: BRANCH_A, positionId: null, departmentId: null },
    ])
  })

  it("rejects a caller without hr_personnel read", async () => {
    await expect(
      getPersonnelOrgChart(asDb(createDb({})), {
        companyId: CID,
        roles: noHrRoles,
        branchId: BRANCH_A,
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("returns 403 when a branch-restricted user asks for another branch", async () => {
    const db = createDb({ branch: { id: BRANCH_A, code: "A", name: "สาขา A" } })

    await expect(
      getPersonnelOrgChart(asDb(db), { companyId: CID, roles: managerB, branchId: BRANCH_A })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("allows Admin on a branch they are not assigned to", async () => {
    const db = createDb({ branch: { id: BRANCH_B, code: "B", name: "สาขา B" } })

    const { data } = await getPersonnelOrgChart(asDb(db), {
      companyId: CID,
      roles: adminRoles,
      branchId: BRANCH_B,
    })
    expect(data.branch.id).toBe(BRANCH_B)
  })

  it("rejects a malformed branch id before querying", async () => {
    const db = createDb({})

    await expect(
      getPersonnelOrgChart(asDb(db), { companyId: CID, roles: managerA, branchId: "nope" })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(db.position.findMany).not.toHaveBeenCalled()
  })

  it("rejects a branch outside the company", async () => {
    const db = createDb({ branch: null })

    await expect(
      getPersonnelOrgChart(asDb(db), { companyId: CID, roles: adminRoles, branchId: BRANCH_A })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("returns an empty chart when the branch has no positions yet", async () => {
    const db = createDb({
      positions: [],
      people: [person({ id: PERSON_1 })],
    })

    const { data } = await getPersonnelOrgChart(asDb(db), {
      companyId: CID,
      roles: managerA,
      branchId: BRANCH_A,
    })

    expect(data.roots).toEqual([])
    expect(data.totals.positions).toBe(0)
    expect(data.unplaced).toHaveLength(1)
  })
})
