import type { PrismaClient } from "@prisma/client"

const AUTO_DRIVER_CODE = /^DRV-\d{4}-\d{5}$/
const AUTO_CUSTOMER_CODE = /^CUST-\d{4}-\d{5}$/

export function isAutoDriverCode(code: string | null | undefined): boolean {
  return !!code && AUTO_DRIVER_CODE.test(code)
}

export function isAutoCustomerCode(code: string | null | undefined): boolean {
  return !!code && AUTO_CUSTOMER_CODE.test(code)
}

function nextSeqFromCodes(codes: string[], prefix: string): number {
  return codes.reduce((max, code) => {
    if (!code.startsWith(prefix)) return max
    const n = parseInt(code.slice(prefix.length), 10)
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)
}

async function generateSequentialCode(
  db: Pick<PrismaClient, "tmsCustomer" | "driver">,
  params: { companyId: string; prefix: string; entity: "customer" | "driver" }
): Promise<string> {
  const year = new Date().getFullYear()
  const fullPrefix = `${params.prefix}-${year}-`
  const count =
    params.entity === "customer"
      ? await db.tmsCustomer.count({
          where: { companyId: params.companyId, code: { startsWith: fullPrefix } },
        })
      : await db.driver.count({
          where: { companyId: params.companyId, code: { startsWith: fullPrefix } },
        })
  return `${fullPrefix}${String(count + 1).padStart(5, "0")}`
}

export function generateTmsCustomerCode(
  db: Pick<PrismaClient, "tmsCustomer" | "driver">,
  companyId: string
) {
  return generateSequentialCode(db, { companyId, prefix: "CUST", entity: "customer" })
}

export function generateDriverCode(
  db: Pick<PrismaClient, "tmsCustomer" | "driver">,
  companyId: string
) {
  return generateSequentialCode(db, { companyId, prefix: "DRV", entity: "driver" })
}

export async function migrateLegacyDriverCodes(
  db: PrismaClient,
  companyId: string
): Promise<number> {
  const year = new Date().getFullYear()
  const prefix = `DRV-${year}-`

  const drivers = await db.driver.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, code: true },
  })

  let nextSeq = nextSeqFromCodes(
    drivers.map((d) => d.code).filter((c) => isAutoDriverCode(c)),
    prefix
  )

  let migrated = 0
  for (const driver of drivers) {
    if (isAutoDriverCode(driver.code)) continue
    nextSeq += 1
    await db.driver.update({
      where: { id: driver.id },
      data: { code: `${prefix}${String(nextSeq).padStart(5, "0")}` },
    })
    migrated += 1
  }
  return migrated
}

export async function migrateLegacyCustomerCodes(
  db: PrismaClient,
  companyId: string
): Promise<number> {
  const year = new Date().getFullYear()
  const prefix = `CUST-${year}-`

  const customers = await db.tmsCustomer.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, code: true },
  })

  let nextSeq = nextSeqFromCodes(
    customers.map((c) => c.code).filter((c): c is string => isAutoCustomerCode(c)),
    prefix
  )

  let migrated = 0
  for (const customer of customers) {
    if (isAutoCustomerCode(customer.code)) continue
    nextSeq += 1
    await db.tmsCustomer.update({
      where: { id: customer.id },
      data: { code: `${prefix}${String(nextSeq).padStart(5, "0")}` },
    })
    migrated += 1
  }
  return migrated
}

export async function migrateLegacyTransportCodes(
  db: PrismaClient,
  companyId: string
): Promise<{ drivers: number; customers: number }> {
  const drivers = await migrateLegacyDriverCodes(db, companyId)
  const customers = await migrateLegacyCustomerCodes(db, companyId)
  return { drivers, customers }
}
