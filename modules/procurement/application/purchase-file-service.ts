import type { PrismaClient } from "@prisma/client"
import { NotFoundError, StorageUnavailableError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import {
  buildObjectKey,
  createObjectStorage,
  inspectUpload,
  sha256Hex,
  S3ConfigError,
  type ObjectStorage,
} from "@/modules/storage"
import {
  attachmentSlotsLeft,
  canChangeAttachments,
  MAX_PURCHASE_ATTACHMENTS,
  PURCHASE_ATTACHMENT_KINDS,
  type PurchaseAttachmentKindValue,
  type PurchaseOrderStatusValue,
} from "./po-rules"
import { findPurchaseOrderForFile, purchaseAttachmentFilePath } from "./purchase-order-service"

const MODULE = "procurement"
const ENTITY = "purchase_order"

function resolveObjectStorage(storage?: ObjectStorage): ObjectStorage {
  if (storage) return storage
  try {
    return createObjectStorage()
  } catch (err) {
    if (err instanceof S3ConfigError) console.error(err.message)
    else console.error("s3 config invalid")
    throw new StorageUnavailableError()
  }
}

export function parseAttachmentKind(value: unknown): PurchaseAttachmentKindValue {
  return (PURCHASE_ATTACHMENT_KINDS as readonly string[]).includes(String(value))
    ? (value as PurchaseAttachmentKindValue)
    : "OTHER"
}

export async function uploadPurchaseFile(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    kind: PurchaseAttachmentKindValue
    originalName: string
    body: Buffer
    storage?: ObjectStorage
  }
) {
  const po = await findPurchaseOrderForFile(db, params, "update")
  if (!canChangeAttachments(po.status as PurchaseOrderStatusValue)) {
    throw new ValidationError("แนบรูปได้จนถึงก่อนรับของเท่านั้น")
  }
  if (attachmentSlotsLeft(po.attachments.length) === 0) {
    throw new ValidationError(`แนบได้ไม่เกิน ${MAX_PURCHASE_ATTACHMENTS} ไฟล์`)
  }
  const storage = resolveObjectStorage(params.storage)
  const inspected = inspectUpload(params.body, params.originalName, storage.maxUploadBytes)
  const { fileId, objectKey } = buildObjectKey({ module: MODULE, entityType: ENTITY, recordId: po.id })
  const checksum = sha256Hex(params.body)
  await storage.putObject({ key: objectKey, body: params.body, contentType: inspected.contentType })
  try {
    const created = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${po.id}::uuid FOR UPDATE`
      const used = await tx.purchaseOrderAttachment.count({ where: { purchaseOrderId: po.id } })
      if (attachmentSlotsLeft(used) === 0) {
        throw new ValidationError(`แนบได้ไม่เกิน ${MAX_PURCHASE_ATTACHMENTS} ไฟล์`)
      }
      await tx.storedFile.create({
        data: {
          id: fileId,
          companyId: params.companyId,
          branchId: po.branchId,
          bucket: storage.bucket,
          objectKey,
          originalName: inspected.originalName,
          contentType: inspected.contentType,
          sizeBytes: params.body.length,
          sha256: checksum,
          module: MODULE,
          entityType: ENTITY,
          entityId: po.id,
          uploadedById: params.userId,
        },
      })
      const row = await tx.purchaseOrderAttachment.create({
        data: { purchaseOrderId: po.id, kind: params.kind, storedFileId: fileId, uploadedBy: params.userId },
      })
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          tableName: "purchase_order_attachments",
          recordId: row.id,
          action: "create",
          newValues: { purchaseOrderId: po.id, kind: params.kind, fileName: inspected.originalName },
        },
      })
      return row
    })
    return {
      data: {
        id: created.id,
        kind: params.kind,
        fileName: inspected.originalName,
        contentType: inspected.contentType,
        sizeBytes: params.body.length,
        url: purchaseAttachmentFilePath(po.id, created.id),
        createdAt: created.createdAt.toISOString(),
      },
    }
  } catch (err) {
    try {
      await storage.deleteObject(objectKey)
    } catch {
      console.error("stored file cleanup failed", { fileId, purchaseOrderId: po.id, module: MODULE })
    }
    throw err
  }
}

async function readStoredBytes(
  db: PrismaClient,
  params: { companyId: string; poId: string; attachmentId: string; storage?: ObjectStorage }
) {
  const attachment = await db.purchaseOrderAttachment.findFirst({
    where: { id: params.attachmentId, purchaseOrderId: params.poId },
    include: { storedFile: true },
  })
  const stored = attachment?.storedFile
  if (
    !stored ||
    stored.deletedAt ||
    stored.companyId !== params.companyId ||
    stored.entityId !== params.poId ||
    stored.module !== MODULE ||
    stored.entityType !== ENTITY
  ) {
    throw new NotFoundError("ไม่พบไฟล์")
  }
  const storage = resolveObjectStorage(params.storage)
  const bytes = await storage.getObject(stored.objectKey)
  if (sha256Hex(bytes) !== stored.sha256.trim()) {
    console.error("stored file checksum mismatch", { fileId: stored.id, module: MODULE })
    throw new StorageUnavailableError()
  }
  return { bytes, contentType: stored.contentType, originalName: stored.originalName }
}

export async function readPurchaseAttachmentFile(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; attachmentId: string; storage?: ObjectStorage }
) {
  const po = await findPurchaseOrderForFile(db, params, "read")
  return readStoredBytes(db, { ...params, poId: po.id })
}

/**
 * Finance reads photos of a RECEIVED order from its source queue and bills.
 * The caller must already hold `expenses:read`; procurement read is not required.
 */
export async function readReceivedPurchaseAttachmentForFinance(
  db: PrismaClient,
  params: { companyId: string; id: string; attachmentId: string; storage?: ObjectStorage }
) {
  const po = await db.purchaseOrder.findFirst({
    where: { id: params.id, companyId: params.companyId, deletedAt: null, status: "RECEIVED" },
    select: { id: true },
  })
  if (!po) throw new NotFoundError("ไม่พบไฟล์")
  return readStoredBytes(db, { ...params, poId: po.id })
}

export async function removePurchaseAttachment(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string; attachmentId: string }
) {
  const po = await findPurchaseOrderForFile(db, params, "update")
  if (!canChangeAttachments(po.status as PurchaseOrderStatusValue)) {
    throw new ValidationError("ลบรูปได้จนถึงก่อนรับของเท่านั้น")
  }
  const attachment = await db.purchaseOrderAttachment.findFirst({
    where: { id: params.attachmentId, purchaseOrderId: po.id },
    select: { id: true, storedFileId: true, kind: true },
  })
  if (!attachment) throw new NotFoundError("ไม่พบไฟล์")
  await db.$transaction(async (tx) => {
    await tx.purchaseOrderAttachment.delete({ where: { id: attachment.id } })
    await tx.storedFile.update({ where: { id: attachment.storedFileId }, data: { deletedAt: new Date() } })
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        tableName: "purchase_order_attachments",
        recordId: attachment.id,
        action: "delete",
        oldValues: { purchaseOrderId: po.id, kind: attachment.kind },
      },
    })
  })
  return { data: { id: attachment.id } }
}
