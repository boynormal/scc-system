const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE machines ADD COLUMN IF NOT EXISTS pm_general TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE machines ADD COLUMN IF NOT EXISTS pm_major TEXT`)
  console.log("✅ Added pm_general and pm_major columns to machines table")
}

main()
  .catch((e) => { console.error("❌ Error:", e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
