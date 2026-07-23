import type { Prisma } from "@prisma/client"

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
