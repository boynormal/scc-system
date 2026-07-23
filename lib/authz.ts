import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError } from "@/lib/errors"

/**
 * ตรวจว่า userId มี UserBranchRole ใน branchId ที่ระบุ
 * ถ้าไม่มี → throw ForbiddenError
 */
export async function assertBranchAccess(
  db: PrismaClient,
  userId: string,
  branchId: string
): Promise<void> {
  const ubr = await db.userBranchRole.findFirst({
    where: { userId, branchId },
    select: { id: true },
  })
  if (!ubr) throw new ForbiddenError("No access to this branch")
}

/**
 * ตรวจว่า machine อยู่ใน company เดียวกัน
 * ถ้าไม่พบ → throw NotFoundError
 */
export async function assertMachineOwnership(
  db: PrismaClient,
  machineId: string,
  companyId: string
): Promise<void> {
  const machine = await db.machine.findFirst({
    where: { id: machineId, deletedAt: null, branch: { companyId } },
    select: { id: true },
  })
  if (!machine) throw new NotFoundError("Machine not found")
}

/**
 * ตรวจว่า work order อยู่ใน company เดียวกัน
 * ถ้าไม่พบ → throw NotFoundError
 */
export async function assertWorkOrderOwnership(
  db: PrismaClient,
  workOrderId: string,
  companyId: string
): Promise<void> {
  const wo = await db.workOrder.findFirst({
    where: { id: workOrderId, branch: { companyId } },
    select: { id: true },
  })
  if (!wo) throw new NotFoundError("Work order not found")
}

/**
 * ตรวจว่า spare part อยู่ใน company เดียวกัน
 * ถ้าไม่พบ → throw NotFoundError
 */
export async function assertSparePartOwnership(
  db: PrismaClient,
  sparePartId: string,
  companyId: string
): Promise<void> {
  const part = await db.sparePart.findFirst({
    where: { id: sparePartId, companyId },
    select: { id: true },
  })
  if (!part) throw new NotFoundError("Spare part not found")
}
