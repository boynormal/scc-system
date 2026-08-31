import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { getBranchIds, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { canReadPersonnel } from "./personnel-service"

const uuidSchema = z.string().uuid()

export type OrgChartOccupant = {
  id: string
  rosterNo: string
  displayName: string
  jobGroup: string | null
  isActive: boolean
}

export type OrgChartNode = {
  id: string
  name: string
  code: string | null
  department: { id: string; name: string; code: string | null } | null
  headcount: number
  /** JD บรรทัดละ 1 ข้อ ตัดบรรทัดว่างออกแล้ว */
  responsibilities: string[]
  isActive: boolean
  depth: number
  occupants: OrgChartOccupant[]
  vacancy: number
  /** จำนวนตำแหน่งในกิ่งนี้รวมตัวเอง — ใช้ตัดสินใจยุบ/ขยายและวาดผัง */
  subtreeSize: number
  children: OrgChartNode[]
}

export type PersonnelOrgChart = {
  branch: { id: string; code: string; name: string }
  totals: {
    positions: number
    headcount: number
    occupied: number
    vacancy: number
    unplaced: number
  }
  roots: OrgChartNode[]
  /** คนในสาขานี้ที่ยังไม่ถูกผูกตำแหน่ง */
  unplaced: OrgChartOccupant[]
}

type PositionRaw = {
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

type PersonRaw = {
  id: string
  rosterNo: string
  displayName: string
  jobGroup: string | null
  isActive: boolean
  positionId: string | null
}

function toOccupant(row: PersonRaw): OrgChartOccupant {
  return {
    id: row.id,
    rosterNo: row.rosterNo,
    displayName: row.displayName,
    jobGroup: row.jobGroup,
    isActive: row.isActive,
  }
}

export function parseResponsibilities(text: string | null): string[] {
  if (!text) return []
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function comparePositions(a: PositionRaw, b: PositionRaw): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  const byName = a.name.localeCompare(b.name, "th")
  if (byName !== 0) return byName
  return a.id.localeCompare(b.id)
}

/**
 * ประกอบต้นไม้ในหน่วยความจำจาก query แบนครั้งเดียว — ไม่ recursive query
 *
 * ตำแหน่งที่ parent ไม่อยู่ในชุด (parent ถูกปิดใช้งานหรือถูกกรองออก) จะเลื่อนขึ้นเป็น root
 * เพื่อไม่ให้กิ่งกำพร้าหายจากผัง
 */
export function buildOrgChartTree(
  positions: PositionRaw[],
  occupantsByPosition: Map<string, OrgChartOccupant[]>
): OrgChartNode[] {
  const byId = new Map(positions.map((p) => [p.id, p]))
  const childIds = new Map<string, string[]>()
  const rootRows: PositionRaw[] = []

  for (const row of positions) {
    const parentId = row.parentId
    if (parentId && parentId !== row.id && byId.has(parentId)) {
      const list = childIds.get(parentId)
      if (list) list.push(row.id)
      else childIds.set(parentId, [row.id])
    } else {
      rootRows.push(row)
    }
  }

  const visited = new Set<string>()
  const build = (row: PositionRaw, depth: number): OrgChartNode => {
    visited.add(row.id)
    const childRows = (childIds.get(row.id) ?? [])
      .filter((id) => !visited.has(id))
      .map((id) => byId.get(id)!)
    for (const child of childRows) visited.add(child.id)
    childRows.sort(comparePositions)

    const children = childRows.map((child) => build(child, depth + 1))
    const occupants = occupantsByPosition.get(row.id) ?? []
    const activeOccupants = occupants.filter((o) => o.isActive).length

    return {
      id: row.id,
      name: row.name,
      code: row.code,
      department: row.department,
      headcount: row.headcount,
      responsibilities: parseResponsibilities(row.responsibilities),
      isActive: row.isActive,
      depth,
      occupants,
      vacancy: Math.max(0, row.headcount - activeOccupants),
      subtreeSize: 1 + children.reduce((sum, c) => sum + c.subtreeSize, 0),
      children,
    }
  }

  rootRows.sort(comparePositions)
  const roots = rootRows.map((row) => build(row, 0))

  // แถวที่ติดในวงกลมจะไม่เคยเป็น root — ยกขึ้นมาเพื่อไม่ให้ข้อมูลหาย
  const trapped = positions.filter((row) => !visited.has(row.id))
  trapped.sort(comparePositions)
  for (const row of trapped) {
    if (visited.has(row.id)) continue
    roots.push(build(row, 0))
  }

  return roots
}

export function flattenOrgChart(roots: OrgChartNode[]): OrgChartNode[] {
  const out: OrgChartNode[] = []
  const walk = (nodes: OrgChartNode[]) => {
    for (const node of nodes) {
      out.push(node)
      walk(node.children)
    }
  }
  walk(roots)
  return out
}

/**
 * ผังองค์กรต่อสาขา: Position tree + คนที่นั่งแต่ละกล่อง + ตำแหน่งว่าง + JD
 *
 * ใช้สิทธิ์ชุดเดียวกับมุมมองแผนก (`getPersonnelOrgView`) — อ่านได้เมื่ออ่านบุคลากรได้
 * และต้องมีสิทธิ์ในสาขานั้น (Admin ข้ามได้)
 */
export async function getPersonnelOrgChart(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId: string
    search?: string | null
    isActive?: boolean | null
    includeInactivePositions?: boolean
  }
): Promise<{ data: PersonnelOrgChart }> {
  if (!canReadPersonnel(params.roles)) throw new ForbiddenError()

  const parsedBranch = uuidSchema.safeParse(params.branchId)
  if (!parsedBranch.success) throw new ValidationError("Invalid branch")

  const branchId = parsedBranch.data
  const branch = await db.branch.findFirst({
    where: { id: branchId, companyId: params.companyId, deletedAt: null, isActive: true },
    select: { id: true, code: true, name: true },
  })
  if (!branch) throw new ValidationError("Invalid branch")

  if (!isAdminInAnyBranch(params.roles) && !getBranchIds(params.roles).includes(branchId)) {
    throw new ForbiddenError("ไม่มีสิทธิ์ในสาขาที่เลือก")
  }

  const isActiveFilter = params.isActive === undefined ? true : params.isActive
  const search = params.search?.trim() || null

  // สาขาของคน: ผูกตำแหน่งในสาขานี้ หรือแผนกบ้านอยู่สาขานี้ หรือสาขาหลักคือสาขานี้
  const scopeParts: Prisma.PersonnelWhereInput[] = [
    {
      OR: [
        { position: { branchId } },
        { department: { branchId } },
        { branchId, positionId: null, departmentId: null },
      ],
    },
  ]
  if (isActiveFilter === true || isActiveFilter === false) {
    scopeParts.push({ isActive: isActiveFilter })
  }

  const [positions, people] = await Promise.all([
    db.position.findMany({
      where: {
        branchId,
        ...(params.includeInactivePositions ? {} : { isActive: true }),
      },
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
        sortOrder: true,
        headcount: true,
        responsibilities: true,
        isActive: true,
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.personnel.findMany({
      where: {
        companyId: params.companyId,
        deletedAt: null,
        AND: scopeParts,
      },
      select: {
        id: true,
        rosterNo: true,
        displayName: true,
        jobGroup: true,
        isActive: true,
        positionId: true,
      },
      orderBy: { displayName: "asc" },
    }),
  ])

  const positionIds = new Set(positions.map((p) => p.id))
  const occupantsByPosition = new Map<string, OrgChartOccupant[]>()
  const unplaced: OrgChartOccupant[] = []

  for (const person of people as PersonRaw[]) {
    const occupant = toOccupant(person)
    if (person.positionId && positionIds.has(person.positionId)) {
      const list = occupantsByPosition.get(person.positionId)
      if (list) list.push(occupant)
      else occupantsByPosition.set(person.positionId, [occupant])
      continue
    }
    unplaced.push(occupant)
  }

  const roots = buildOrgChartTree(positions as PositionRaw[], occupantsByPosition)

  /**
   * ค้นหาไม่ตัดต้นไม้ — คงกิ่งไว้ครบและทำเครื่องหมายที่กล่องแทน มิฉะนั้นสายบังคับบัญชาจะขาด
   * ผู้เรียกใช้ `matchesOrgChartSearch` เพื่อไฮไลต์เอง
   */
  const flat = flattenOrgChart(roots)
  const occupied = flat.reduce(
    (sum, node) => sum + node.occupants.filter((o) => o.isActive).length,
    0
  )

  return {
    data: {
      branch,
      totals: {
        positions: flat.length,
        headcount: flat.reduce((sum, node) => sum + node.headcount, 0),
        occupied,
        vacancy: flat.reduce((sum, node) => sum + node.vacancy, 0),
        unplaced: unplaced.length,
      },
      roots,
      unplaced: search ? unplaced.filter((o) => matchesOccupant(o, search)) : unplaced,
    },
  }
}

function matchesOccupant(occupant: OrgChartOccupant, search: string): boolean {
  const q = search.toLowerCase()
  return (
    occupant.displayName.toLowerCase().includes(q) ||
    occupant.rosterNo.toLowerCase().includes(q) ||
    (occupant.jobGroup?.toLowerCase().includes(q) ?? false)
  )
}

/** ใช้ไฮไลต์กล่องที่ตรงคำค้น โดยไม่ตัดกิ่งออกจากผัง */
export function matchesOrgChartSearch(node: OrgChartNode, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return false
  if (node.name.toLowerCase().includes(q)) return true
  if (node.code?.toLowerCase().includes(q)) return true
  if (node.department?.name.toLowerCase().includes(q)) return true
  return node.occupants.some((o) => matchesOccupant(o, q))
}
