import type { Prisma, PrismaClient } from "@prisma/client"

export type PersonnelDbTx = Prisma.TransactionClient

/**
 * ผูกสาขากับพนักงาน — ถ้ายังไม่มีแถวสำหรับสาขานี้จะสร้าง
 * ถ้ายังไม่มีสาขาใดเลย แถวแรกจะเป็น primary และ sync `personnel.branchId`
 */
export async function ensurePersonnelBranch(
  tx: PersonnelDbTx,
  personnelId: string,
  branchId: string,
  opts: { makePrimary?: boolean } = {}
): Promise<void> {
  const existing = await tx.personnelBranch.findUnique({
    where: { personnelId_branchId: { personnelId, branchId } },
  })
  if (existing) {
    if (opts.makePrimary && !existing.isPrimary) {
      await setPersonnelPrimaryBranch(tx, personnelId, branchId)
    }
    return
  }

  const count = await tx.personnelBranch.count({ where: { personnelId } })
  const isPrimary = Boolean(opts.makePrimary) || count === 0

  if (isPrimary) {
    await tx.personnelBranch.updateMany({
      where: { personnelId },
      data: { isPrimary: false },
    })
  }

  await tx.personnelBranch.create({
    data: { personnelId, branchId, isPrimary },
  })

  if (isPrimary) {
    await tx.personnel.update({
      where: { id: personnelId },
      data: { branchId },
    })
  }
}

/** ตั้งสาขาหลัก (หนึ่งคนต้องมีได้แค่หนึ่ง primary — DB partial unique) */
export async function setPersonnelPrimaryBranch(tx: PersonnelDbTx, personnelId: string, branchId: string): Promise<void> {
  const existing = await tx.personnelBranch.findUnique({
    where: { personnelId_branchId: { personnelId, branchId } },
  })
  await tx.personnelBranch.updateMany({ where: { personnelId }, data: { isPrimary: false } })
  if (!existing) {
    await tx.personnelBranch.create({
      data: { personnelId, branchId, isPrimary: true },
    })
  } else {
    await tx.personnelBranch.update({
      where: { personnelId_branchId: { personnelId, branchId } },
      data: { isPrimary: true },
    })
  }
  await tx.personnel.update({
    where: { id: personnelId },
    data: { branchId },
  })
}

/** แทนที่รายการสาขาทั้งหมด (ใช้หลังสร้าง personnel หรือแก้จากฟอร์ม) */
export async function replacePersonnelBranchesFromIds(
  tx: PersonnelDbTx,
  personnelId: string,
  branchIds: string[],
  primaryBranchId: string | null
): Promise<void> {
  const unique = [...new Set(branchIds)]
  await tx.personnelBranch.deleteMany({ where: { personnelId } })

  if (unique.length === 0) {
    await tx.personnel.update({ where: { id: personnelId }, data: { branchId: null } })
    return
  }

  const primary =
    primaryBranchId && unique.includes(primaryBranchId) ? primaryBranchId : unique[0]!

  for (const bid of unique) {
    await tx.personnelBranch.create({
      data: {
        personnelId,
        branchId: bid,
        isPrimary: bid === primary,
      },
    })
  }

  await tx.personnel.update({
    where: { id: personnelId },
    data: { branchId: primary },
  })
}

export type MissingPrimaryPersonnelBranchInsert = {
  personnelId: string
  rosterNo: string
  branchId: string
  isPrimary: boolean
  deletedAt: Date | null
}

export type BackfillMissingPrimaryPersonnelBranchesResult = {
  scanned: number
  skippedNullBranch: number
  skippedAlreadyHasRow: number
  skippedMissingBranch: Array<{ personnelId: string; rosterNo: string; branchId: string }>
  toInsert: MissingPrimaryPersonnelBranchInsert[]
  inserted: number
  dryRun: boolean
}

/**
 * เติมแถว personnel_branches ให้คนที่มี Personnel.branchId แต่ยังไม่มี junction ของสาขานั้น
 * ไม่เรียก ensurePersonnelBranch — จะไม่ UPDATE personnel.branchId และไม่ลบแถวที่มีอยู่
 */
export async function backfillMissingPrimaryPersonnelBranches(
  db: PrismaClient,
  opts: { dryRun?: boolean } = {}
): Promise<BackfillMissingPrimaryPersonnelBranchesResult> {
  const dryRun = opts.dryRun !== false

  const people = await db.personnel.findMany({
    select: { id: true, rosterNo: true, branchId: true, deletedAt: true },
  })

  const withBranch = people.filter((p): p is typeof p & { branchId: string } => p.branchId != null)
  const skippedNullBranch = people.length - withBranch.length

  const uniqueBranchIds = [...new Set(withBranch.map((p) => p.branchId))]
  const existingBranches =
    uniqueBranchIds.length === 0
      ? []
      : await db.branch.findMany({
          where: { id: { in: uniqueBranchIds } },
          select: { id: true },
        })
  const branchSet = new Set(existingBranches.map((b) => b.id))

  const personnelIds = withBranch.map((p) => p.id)
  const existingPb =
    personnelIds.length === 0
      ? []
      : await db.personnelBranch.findMany({
          where: { personnelId: { in: personnelIds } },
          select: { personnelId: true, branchId: true, isPrimary: true },
        })

  const rowsByPersonnel = new Map<string, { branchIds: Set<string>; hasPrimary: boolean }>()
  for (const row of existingPb) {
    const cur = rowsByPersonnel.get(row.personnelId) ?? {
      branchIds: new Set<string>(),
      hasPrimary: false,
    }
    cur.branchIds.add(row.branchId)
    if (row.isPrimary) cur.hasPrimary = true
    rowsByPersonnel.set(row.personnelId, cur)
  }

  const skippedMissingBranch: BackfillMissingPrimaryPersonnelBranchesResult["skippedMissingBranch"] = []
  const toInsert: MissingPrimaryPersonnelBranchInsert[] = []
  let skippedAlreadyHasRow = 0

  for (const p of withBranch) {
    if (!branchSet.has(p.branchId)) {
      skippedMissingBranch.push({
        personnelId: p.id,
        rosterNo: p.rosterNo,
        branchId: p.branchId,
      })
      continue
    }
    const cur = rowsByPersonnel.get(p.id)
    if (cur?.branchIds.has(p.branchId)) {
      skippedAlreadyHasRow += 1
      continue
    }
    toInsert.push({
      personnelId: p.id,
      rosterNo: p.rosterNo,
      branchId: p.branchId,
      isPrimary: !cur?.hasPrimary,
      deletedAt: p.deletedAt,
    })
  }

  let inserted = 0
  if (!dryRun && toInsert.length > 0) {
    await db.$transaction(async (tx) => {
      for (const row of toInsert) {
        await tx.personnelBranch.create({
          data: {
            personnelId: row.personnelId,
            branchId: row.branchId,
            isPrimary: row.isPrimary,
          },
        })
      }
    })
    inserted = toInsert.length
  }

  return {
    scanned: people.length,
    skippedNullBranch,
    skippedAlreadyHasRow,
    skippedMissingBranch,
    toInsert,
    inserted,
    dryRun,
  }
}
