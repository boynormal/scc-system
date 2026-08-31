import { prisma } from "@/shared/db"
import { backfillMissingPrimaryPersonnelBranches } from "@/modules/hr/application/personnel-branch-utils"

async function main() {
  const apply = process.argv.includes("--apply")
  const result = await backfillMissingPrimaryPersonnelBranches(prisma, { dryRun: !apply })

  console.log(JSON.stringify(
    {
      dryRun: result.dryRun,
      scanned: result.scanned,
      skippedNullBranch: result.skippedNullBranch,
      skippedAlreadyHasRow: result.skippedAlreadyHasRow,
      skippedMissingBranch: result.skippedMissingBranch,
      toInsertCount: result.toInsert.length,
      inserted: result.inserted,
      toInsertSample: result.toInsert.slice(0, 5),
    },
    null,
    2
  ))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
