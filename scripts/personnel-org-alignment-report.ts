import { prisma } from "@/shared/db"

/**
 * Read-only alignment report for the Personnel Organization View.
 * Does not create, move, or delete departments or personnel.
 *
 *   npx tsx scripts/personnel-org-alignment-report.ts
 */
async function main() {
  const live = { deletedAt: null as Date | null }

  const [
    noDepartment,
    noDepartmentAndNoHomeBranch,
    missingJobGroup,
    inactivePersonnel,
    inactiveDepartmentPointer,
    assignmentCounts,
    departments,
  ] = await Promise.all([
    prisma.personnel.count({ where: { ...live, departmentId: null } }),
    prisma.personnel.count({ where: { ...live, departmentId: null, branchId: null } }),
    prisma.personnel.count({ where: { ...live, OR: [{ jobGroup: null }, { jobGroup: "" }] } }),
    prisma.personnel.count({ where: { ...live, isActive: false } }),
    prisma.personnel.count({ where: { ...live, department: { isActive: false } } }),
    prisma.personnelBranch.groupBy({
      by: ["personnelId"],
      _count: { personnelId: true },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        branchId: true,
        branch: { select: { code: true } },
        _count: { select: { personnel: { where: live } } },
      },
    }),
  ])

  const emptyDepartments = departments.filter((d) => d._count.personnel === 0)
  const nameKey = (d: (typeof departments)[number]) => `${d.branchId}::${d.name}`
  const nameCounts = new Map<string, number>()
  for (const d of departments) {
    const k = nameKey(d)
    nameCounts.set(k, (nameCounts.get(k) ?? 0) + 1)
  }
  const duplicateNamesInBranch = departments
    .filter((d) => (nameCounts.get(nameKey(d)) ?? 0) > 1)
    .map((d) => ({
      id: d.id,
      name: d.name,
      branch: d.branch.code,
      livePersonnel: d._count.personnel,
    }))

  console.log(
    JSON.stringify(
      {
        dryRun: true,
        livePersonnel: {
          noDepartmentId: noDepartment,
          noDepartmentAndNoHomeBranch,
          missingJobGroup,
          inactive: inactivePersonnel,
          inactiveDepartmentPointer,
          withMultiplePersonnelBranches: assignmentCounts.filter((r) => r._count.personnelId > 1).length,
        },
        departments: {
          active: departments.length,
          withZeroLivePersonnel: emptyDepartments.length,
          duplicateNamesInSameBranch: duplicateNamesInBranch,
        },
      },
      null,
      2
    )
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
