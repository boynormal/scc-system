import { prisma } from "@/shared/db"

/**
 * Read-only helper for People Phase 3-Org: proposes a starting Position list per branch
 * from the distinct Personnel.jobGroup values already in the roster.
 *
 * Writes nothing. It does not create positions, does not touch jobGroup, and does not
 * invent departments — HR still builds the tree by hand in /hr/positions.
 *
 *   npx tsx scripts/positions-from-jobgroup-report.ts
 */
async function main() {
  const [branches, people, positions] = await Promise.all([
    prisma.branch.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    prisma.personnel.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        branchId: true,
        jobGroup: true,
        positionId: true,
        department: { select: { branchId: true, name: true } },
      },
    }),
    prisma.position.findMany({
      select: { id: true, branchId: true, name: true, code: true, parentId: true, isActive: true },
      orderBy: { name: "asc" },
    }),
  ])

  const branchLabel = new Map(branches.map((b) => [b.id, `${b.code} — ${b.name}`]))

  type Proposal = { jobGroup: string; livePeople: number; alreadyHasPosition: boolean }
  const byBranch = new Map<string, Map<string, { count: number }>>()
  let peopleWithoutHomeBranch = 0
  let peopleWithoutJobGroup = 0
  let peopleAlreadyOnPosition = 0

  for (const person of people) {
    if (person.positionId) peopleAlreadyOnPosition += 1
    // แผนกบ้านชี้สาขาจริงกว่า branchId เดิม — ใช้แผนกก่อนถ้ามี
    const branchId = person.department?.branchId ?? person.branchId
    if (!branchId) {
      peopleWithoutHomeBranch += 1
      continue
    }
    const jobGroup = person.jobGroup?.trim()
    if (!jobGroup) {
      peopleWithoutJobGroup += 1
      continue
    }
    const bucket = byBranch.get(branchId) ?? new Map<string, { count: number }>()
    const entry = bucket.get(jobGroup) ?? { count: 0 }
    entry.count += 1
    bucket.set(jobGroup, entry)
    byBranch.set(branchId, bucket)
  }

  const existingNames = new Map<string, Set<string>>()
  for (const p of positions) {
    const set = existingNames.get(p.branchId) ?? new Set<string>()
    set.add(p.name.trim())
    existingNames.set(p.branchId, set)
  }

  const report = [...byBranch.entries()]
    .map(([branchId, bucket]) => {
      const existing = existingNames.get(branchId) ?? new Set<string>()
      const proposals: Proposal[] = [...bucket.entries()]
        .map(([jobGroup, v]) => ({
          jobGroup,
          livePeople: v.count,
          alreadyHasPosition: existing.has(jobGroup),
        }))
        .sort((a, b) => b.livePeople - a.livePeople || a.jobGroup.localeCompare(b.jobGroup, "th"))

      return {
        branch: branchLabel.get(branchId) ?? branchId,
        branchId,
        existingPositions: positions.filter((p) => p.branchId === branchId).length,
        rootPositions: positions.filter((p) => p.branchId === branchId && !p.parentId).length,
        proposedFromJobGroup: proposals,
      }
    })
    .sort((a, b) => a.branch.localeCompare(b.branch, "th"))

  console.log(
    JSON.stringify(
      {
        dryRun: true,
        note: "อ่านอย่างเดียว — ไม่สร้างตำแหน่ง ไม่แก้ jobGroup ไม่สร้างแผนก",
        summary: {
          livePeople: people.length,
          peopleAlreadyOnPosition,
          peopleWithoutJobGroup,
          peopleWithoutHomeBranch,
          existingPositions: positions.length,
          inactivePositions: positions.filter((p) => !p.isActive).length,
        },
        branches: report,
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
