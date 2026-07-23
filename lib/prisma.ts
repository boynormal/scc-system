import { Prisma, PrismaClient } from "@prisma/client"

/** Bump when schema changes require a fresh PrismaClient (dev hot-reload keeps old singleton). */
const PRISMA_SCHEMA_FINGERPRINT = "20260704-tms-customer-location-v2"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaFingerprint?: string
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })
}

function modelHasField(modelName: string, fieldName: string): boolean {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName)
  return model?.fields.some((f) => f.name === fieldName) ?? false
}

function isStalePrismaClient(client: PrismaClient | undefined): boolean {
  if (!client) return false
  if (globalForPrisma.prismaSchemaFingerprint !== PRISMA_SCHEMA_FINGERPRINT) return true
  if (!modelHasField("TmsCustomer", "latitude")) return true
  return (
    typeof (client as unknown as { machineSparePart?: unknown }).machineSparePart === "undefined" ||
    typeof (client as unknown as { personnel?: unknown }).personnel === "undefined"
  )
}

let prisma: PrismaClient
if (isStalePrismaClient(globalForPrisma.prisma)) {
  void globalForPrisma.prisma!.$disconnect().catch(() => {})
  globalForPrisma.prisma = undefined
}

prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaSchemaFingerprint = PRISMA_SCHEMA_FINGERPRINT
}

export { prisma }
