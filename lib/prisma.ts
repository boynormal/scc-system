import { Prisma, PrismaClient } from "@prisma/client"

/** Bump when schema changes require a fresh PrismaClient (dev hot-reload keeps old singleton). */
const PRISMA_SCHEMA_FINGERPRINT = "20261125-po-supplier-nullable-reload"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaFingerprint?: string
}

/** Dev hot reload keeps the first `@prisma/client` in Node's require cache after `prisma generate`. */
function loadPrismaClientCtor(): typeof PrismaClient {
  if (process.env.NODE_ENV === "production") return PrismaClient
  try {
    const { createRequire } = require("node:module") as typeof import("node:module")
    const { pathToFileURL } = require("node:url") as typeof import("node:url")
    const path = require("node:path") as typeof import("node:path")
    const req = createRequire(pathToFileURL(path.join(process.cwd(), "package.json")))
    for (const key of Object.keys(req.cache)) {
      const norm = key.replace(/\\/g, "/")
      if (norm.includes("/.prisma/client") || norm.includes("/@prisma/client")) delete req.cache[key]
    }
    return (req("@prisma/client") as typeof import("@prisma/client")).PrismaClient
  } catch {
    return PrismaClient
  }
}

function createPrismaClient() {
  const Ctor = loadPrismaClientCtor()
  return new Ctor({
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
    typeof (client as unknown as { personnel?: unknown }).personnel === "undefined" ||
    typeof (client as unknown as { expenseCategory?: unknown }).expenseCategory === "undefined" ||
    typeof (client as unknown as { expenseTypeCostCenter?: unknown }).expenseTypeCostCenter === "undefined"
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
