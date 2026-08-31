import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { getBranchIds, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { canReadPersonnel } from "./personnel-service"

const uuidSchema = z.string().uuid()

export type PersonnelOrgCard = {
  id: string
  rosterNo: string
  displayName: string
  jobGroup: string | null
  isActive: boolean
}

export type PersonnelOrgDepartment = {
  id: string
  name: string
  code: string | null
  personnelCount: number
  personnel: PersonnelOrgCard[]
}

export type PersonnelOrgView = {
  branch: { id: string; code: string; name: string }
  totals: { personnel: number; departments: number; unassigned: number }
  departments: PersonnelOrgDepartment[]
  unassigned: PersonnelOrgCard[]
}

function toCard(row: {
  id: string
  rosterNo: string
  displayName: string
  jobGroup: string | null
  isActive: boolean
}): PersonnelOrgCard {
  return {
    id: row.id,
    rosterNo: row.rosterNo,
    displayName: row.displayName,
    jobGroup: row.jobGroup,
    isActive: row.isActive,
  }
}

/**
 * Read model: Branch → active Department → Personnel.
 * Organizational home is Personnel.departmentId → Department.branchId.
 * PersonnelBranch is not used and must not duplicate membership.
 */
export async function getPersonnelOrgView(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId: string
    search?: string | null
    isActive?: boolean | null
  }
): Promise<{ data: PersonnelOrgView }> {
  if (!canReadPersonnel(params.roles)) throw new ForbiddenError()

  const parsedBranch = uuidSchema.safeParse(params.branchId)
  if (!parsedBranch.success) throw new ValidationError("Invalid branch")

  const branchId = parsedBranch.data
  const branch = await db.branch.findFirst({
    where: { id: branchId, companyId: params.companyId, deletedAt: null, isActive: true },
    select: { id: true, code: true, name: true },
  })
  if (!branch) throw new ValidationError("Invalid branch")

  const isAdmin = isAdminInAnyBranch(params.roles)
  if (!isAdmin && !getBranchIds(params.roles).includes(branchId)) {
    throw new ForbiddenError("ไม่มีสิทธิ์ในสาขาที่เลือก")
  }

  const isActiveFilter = params.isActive === undefined ? true : params.isActive
  const search = params.search?.trim() || null

  const andParts: Prisma.PersonnelWhereInput[] = [
    {
      OR: [
        { department: { isActive: true, branchId } },
        {
          branchId,
          OR: [{ departmentId: null }, { department: { isActive: false } }],
        },
      ],
    },
  ]
  if (isActiveFilter === true || isActiveFilter === false) {
    andParts.push({ isActive: isActiveFilter })
  }
  if (search) {
    andParts.push({
      OR: [
        { displayName: { contains: search, mode: "insensitive" } },
        { rosterNo: { contains: search, mode: "insensitive" } },
        { jobGroup: { contains: search, mode: "insensitive" } },
      ],
    })
  }

  const [departments, people] = await Promise.all([
    db.department.findMany({
      where: { branchId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    db.personnel.findMany({
      where: {
        companyId: params.companyId,
        deletedAt: null,
        AND: andParts,
      },
      select: {
        id: true,
        rosterNo: true,
        displayName: true,
        jobGroup: true,
        isActive: true,
        departmentId: true,
        branchId: true,
        department: { select: { id: true, isActive: true, branchId: true } },
      },
      orderBy: { displayName: "asc" },
    }),
  ])

  const byDept = new Map<string, PersonnelOrgCard[]>()
  for (const d of departments) byDept.set(d.id, [])

  const unassigned: PersonnelOrgCard[] = []
  for (const person of people) {
    const card = toCard(person)
    const dept = person.department
    if (dept?.isActive && dept.branchId === branchId) {
      const list = byDept.get(dept.id)
      if (list) list.push(card)
      continue
    }
    unassigned.push(card)
  }

  const departmentRows: PersonnelOrgDepartment[] = departments.map((d) => {
    const personnel = byDept.get(d.id) ?? []
    return {
      id: d.id,
      name: d.name,
      code: d.code,
      personnelCount: personnel.length,
      personnel,
    }
  })

  return {
    data: {
      branch,
      totals: {
        personnel: people.length,
        departments: departments.length,
        unassigned: unassigned.length,
      },
      departments: departmentRows,
      unassigned,
    },
  }
}
