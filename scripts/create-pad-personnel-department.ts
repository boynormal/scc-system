import { prisma } from "@/shared/db"
import { createDepartment } from "@/modules/settings/application/master-data-service"

const DEPT_NAME = "บุคลากรโรงกระดาษ"
const DEPT_CODE = "PPL"
const BRANCH_CODE = "PAD"

async function main() {
  const pads = await prisma.branch.findMany({
    where: { code: BRANCH_CODE, deletedAt: null, isActive: true },
    select: { id: true, name: true, companyId: true, company: { select: { name: true } } },
  })

  if (pads.length === 0) {
    throw new Error("ไม่พบสาขา PAD ที่ใช้งานอยู่")
  }

  const withPersonnel = await Promise.all(
    pads.map(async (b) => {
      const personnelCount = await prisma.personnel.count({ where: { branchId: b.id } })
      return { ...b, personnelCount }
    })
  )
  withPersonnel.sort((a, b) => b.personnelCount - a.personnelCount)
  const pad = withPersonnel[0]!

  const existing = await prisma.department.findFirst({
    where: { branchId: pad.id, code: DEPT_CODE, name: DEPT_NAME },
  })
  if (existing) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason: "already exists",
          departmentId: existing.id,
          branchId: pad.id,
          branchName: pad.name,
          companyId: pad.companyId,
        },
        null,
        2
      )
    )
    return
  }

  const result = await createDepartment(prisma, {
    companyId: pad.companyId,
    input: { name: DEPT_NAME, code: DEPT_CODE, branchId: pad.id },
  })

  if ("error" in result) {
    throw new Error(`createDepartment failed: ${JSON.stringify(result)}`)
  }

  console.log(
    JSON.stringify(
      {
        created: true,
        departmentId: result.data.id,
        name: result.data.name,
        code: result.data.code,
        branchId: pad.id,
        branchName: pad.name,
        companyName: pad.company.name,
        companyId: pad.companyId,
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
