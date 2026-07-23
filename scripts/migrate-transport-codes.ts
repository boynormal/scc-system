import { prisma } from "@/shared/db"
import { migrateLegacyTransportCodes } from "@/modules/transport/application/generate-entity-code"

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } })

  let totalDrivers = 0
  let totalCustomers = 0

  for (const company of companies) {
    const result = await migrateLegacyTransportCodes(prisma, company.id)
    if (result.drivers > 0 || result.customers > 0) {
      console.log(
        `${company.name}: คนขับ ${result.drivers} รายการ, ลูกค้า/ปลายทาง ${result.customers} รายการ`
      )
    }
    totalDrivers += result.drivers
    totalCustomers += result.customers
  }

  console.log(`เสร็จสิ้น — ปรับรหัสคนขับ ${totalDrivers} รายการ, ลูกค้า/ปลายทาง ${totalCustomers} รายการ`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
