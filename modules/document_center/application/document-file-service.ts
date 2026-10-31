import { randomUUID } from "node:crypto"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, StorageUnavailableError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { getBranchIds } from "@/lib/permissions"
import type { RequestAuditMeta } from "@/lib/request-audit"
import { readBranchSharing } from "@/shared/permissions/branch-sharing"
import {
  S3ConfigError,
  buildObjectKey,
  contentDispositionAttachment,
  contentDispositionInline,
  createObjectStorage,
  inspectDocumentUpload,
  sha256Hex,
  type ObjectStorage,
} from "@/modules/storage"
import { canDocuments, canTouchDocument } from "./access"
import {
  assertActiveCategory,
  assertActiveType,
  assertDepartment,
  assertMetadataDates,
  loadReadableDocument,
  metadataDates,
  requireMutableDocument,
  type CreateDocumentInput,
} from "./document-service"
import {
  canPreviewKind,
  fileKindOf,
  generatedDocumentCode,
  isUniqueConflict,
} from "./rules"

const MODULE_KEY = "document_center"
const ENTITY_TYPE = "document"

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

async function storageBranchId(
  db: PrismaClient,
  companyId: string,
  roles: UserRole[],
  documentBranchId: string | null
) {
  if (documentBranchId) return documentBranchId
  const assigned = getBranchIds(roles)[0]
  if (assigned) return assigned
  const any = await db.branch.findFirst({
    where: { companyId, deletedAt: null },
    select: { id: true },
    orderBy: { name: "asc" },
  })
  if (!any) throw new ValidationError("ต้องมีสาขาสำหรับจัดเก็บไฟล์")
  return any.id
}

function cleanupKey(storage: ObjectStorage, objectKey: string, fileId: string) {
  return storage.deleteObject(objectKey).catch(() => {
    console.error("stored file cleanup failed", { fileId, module: MODULE_KEY })
  })
}

export async function createDocument(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    input: CreateDocumentInput
    originalName: string
    body: Buffer
    storage?: ObjectStorage
    audit?: RequestAuditMeta
  }
) {
  if (!canDocuments(params.roles, "create")) throw new ForbiddenError()
  const share = await readBranchSharing(db, params.companyId)
  if (!canTouchDocument(params.roles, "create", null, share.documents)) throw new ForbiddenError()
  await assertActiveCategory(db, params.companyId, params.input.categoryId)
  await assertActiveType(db, params.companyId, params.input.typeId)
  if (params.input.departmentId) await assertDepartment(db, params.companyId, params.input.departmentId)
  const dates = metadataDates(params.input)
  assertMetadataDates(dates.effective ?? null, dates.expiry ?? null)
  const storage = resolveObjectStorage(params.storage)
  const inspected = inspectDocumentUpload(params.body, params.originalName, storage.maxUploadBytes)
  const documentId = randomUUID()
  const fileBranchId = await storageBranchId(db, params.companyId, params.roles, null)
  const { fileId, objectKey } = buildObjectKey({
    module: MODULE_KEY,
    entityType: ENTITY_TYPE,
    recordId: documentId,
  })
  const checksum = sha256Hex(params.body)
  await storage.putObject({ key: objectKey, body: params.body, contentType: inspected.contentType })
  let code = generatedDocumentCode()
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await db.$transaction(async (tx) => {
          await tx.docCenterDocument.create({
            data: {
              id: documentId,
              companyId: params.companyId,
              documentCode: code,
              documentName: params.input.documentName,
              description: params.input.description?.trim() || null,
              categoryId: params.input.categoryId,
              typeId: params.input.typeId,
              branchId: null,
              departmentId: params.input.departmentId ?? null,
              status: params.input.status ?? "ACTIVE",
              tags: [],
              requiresAcknowledgement: params.input.requiresAcknowledgement ?? false,
              effectiveDate: dates.effective ?? null,
              expiryDate: dates.expiry ?? null,
              createdById: params.userId,
              updatedById: params.userId,
            },
          })
          await tx.storedFile.create({
            data: {
              id: fileId,
              companyId: params.companyId,
              branchId: fileBranchId,
              bucket: storage.bucket,
              objectKey,
              originalName: inspected.originalName,
              contentType: inspected.contentType,
              sizeBytes: params.body.length,
              sha256: checksum,
              module: MODULE_KEY,
              entityType: ENTITY_TYPE,
              entityId: documentId,
              uploadedById: params.userId,
            },
          })
          const version = await tx.docCenterVersion.create({
            data: {
              documentId,
              versionNumber: 1,
              storedFileId: fileId,
              changeNote: null,
              uploadedById: params.userId,
            },
          })
          await tx.docCenterDocument.update({
            where: { id: documentId },
            data: { currentVersionId: version.id },
          })
          await tx.auditLog.create({
            data: {
              userId: params.userId,
              tableName: "doc_center_documents",
              recordId: documentId,
              action: "create",
              newValues: { documentCode: code, versionNumber: 1, storedFileId: fileId },
              ipAddress: params.audit?.ipAddress,
              userAgent: params.audit?.userAgent,
            },
          })
        })
        return { data: { id: documentId } }
      } catch (err) {
        if (!isUniqueConflict(err) || attempt === 2) throw err
        code = generatedDocumentCode()
      }
    }
  } catch (err) {
    await cleanupKey(storage, objectKey, fileId)
    if (isUniqueConflict(err)) throw new ValidationError("รหัสเอกสารนี้มีอยู่แล้ว")
    throw err
  }
  await cleanupKey(storage, objectKey, fileId)
  throw new ValidationError("รหัสเอกสารนี้มีอยู่แล้ว")
}

export async function addDocumentVersion(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    originalName: string
    body: Buffer
    changeNote?: string | null
    storage?: ObjectStorage
    audit?: RequestAuditMeta
  }
) {
  const existing = await requireMutableDocument(db, params, "update")
  if (existing.deletedAt) throw new ValidationError("เอกสารถูกลบแล้ว")
  const storage = resolveObjectStorage(params.storage)
  const inspected = inspectDocumentUpload(params.body, params.originalName, storage.maxUploadBytes)
  const { fileId, objectKey } = buildObjectKey({
    module: MODULE_KEY,
    entityType: ENTITY_TYPE,
    recordId: existing.id,
  })
  const checksum = sha256Hex(params.body)
  const fileBranchId = existing.branchId ?? (await storageBranchId(db, params.companyId, params.roles, null))
  await storage.putObject({ key: objectKey, body: params.body, contentType: inspected.contentType })
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const versionId = await db.$transaction(async (tx) => {
          const max = await tx.docCenterVersion.aggregate({
            where: { documentId: existing.id },
            _max: { versionNumber: true },
          })
          const versionNumber = (max._max.versionNumber ?? 0) + 1
          await tx.storedFile.create({
            data: {
              id: fileId,
              companyId: params.companyId,
              branchId: fileBranchId,
              bucket: storage.bucket,
              objectKey,
              originalName: inspected.originalName,
              contentType: inspected.contentType,
              sizeBytes: params.body.length,
              sha256: checksum,
              module: MODULE_KEY,
              entityType: ENTITY_TYPE,
              entityId: existing.id,
              uploadedById: params.userId,
            },
          })
          const version = await tx.docCenterVersion.create({
            data: {
              documentId: existing.id,
              versionNumber,
              storedFileId: fileId,
              changeNote: params.changeNote?.trim() || null,
              uploadedById: params.userId,
            },
          })
          await tx.docCenterDocument.update({
            where: { id: existing.id },
            data: { currentVersionId: version.id, updatedById: params.userId },
          })
          await tx.auditLog.create({
            data: {
              userId: params.userId,
              tableName: "doc_center_documents",
              recordId: existing.id,
              action: "update",
              oldValues: { currentVersionId: existing.currentVersionId },
              newValues: { currentVersionId: version.id, versionNumber },
              ipAddress: params.audit?.ipAddress,
              userAgent: params.audit?.userAgent,
            },
          })
          return version.id
        })
        return { data: { id: existing.id, versionId } }
      } catch (err) {
        if (!isUniqueConflict(err) || attempt === 1) throw err
      }
    }
  } catch (err) {
    await cleanupKey(storage, objectKey, fileId)
    if (isUniqueConflict(err)) throw new ValidationError("ไม่สามารถบันทึกเวอร์ชันได้")
    throw err
  }
  await cleanupKey(storage, objectKey, fileId)
  throw new ValidationError("ไม่สามารถบันทึกเวอร์ชันได้")
}

export async function setCurrentVersion(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    versionId: string
    audit?: RequestAuditMeta
  }
) {
  const existing = await requireMutableDocument(db, params, "update")
  if (existing.deletedAt) throw new ValidationError("เอกสารถูกลบแล้ว")
  const version = await db.docCenterVersion.findFirst({
    where: { id: params.versionId, documentId: existing.id },
    select: { id: true },
  })
  if (!version) throw new NotFoundError("ไม่พบเวอร์ชัน")
  if (existing.currentVersionId === version.id) return { data: { id: existing.id, versionId: version.id } }
  await db.$transaction(async (tx) => {
    await tx.docCenterDocument.update({
      where: { id: existing.id },
      data: { currentVersionId: version.id, updatedById: params.userId },
    })
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        tableName: "doc_center_documents",
        recordId: existing.id,
        action: "update",
        oldValues: { currentVersionId: existing.currentVersionId },
        newValues: { currentVersionId: version.id },
        ipAddress: params.audit?.ipAddress,
        userAgent: params.audit?.userAgent,
      },
    })
  })
  return { data: { id: existing.id, versionId: version.id } }
}

export async function readDocumentFile(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    versionId: string
    disposition: "inline" | "attachment"
    storage?: ObjectStorage
  }
) {
  const existing = await loadReadableDocument(db, params)
  const version = await db.docCenterVersion.findFirst({
    where: { id: params.versionId, documentId: existing.id },
    include: { storedFile: true },
  })
  const stored = version?.storedFile
  if (
    !stored ||
    stored.deletedAt ||
    stored.companyId !== params.companyId ||
    stored.entityId !== existing.id ||
    stored.module !== MODULE_KEY ||
    stored.entityType !== ENTITY_TYPE
  ) {
    throw new NotFoundError("ไม่พบไฟล์")
  }
  const kind = fileKindOf(stored.contentType, stored.originalName)
  if (params.disposition === "inline" && !canPreviewKind(kind)) {
    throw new ValidationError("ไม่รองรับตัวอย่างไฟล์นี้")
  }
  const storage = resolveObjectStorage(params.storage)
  const bytes = await storage.getObject(stored.objectKey)
  if (sha256Hex(bytes) !== stored.sha256.trim()) {
    console.error("stored file checksum mismatch", { fileId: stored.id, module: MODULE_KEY })
    throw new StorageUnavailableError()
  }
  await db.docCenterAccessLog.create({
    data: {
      documentId: existing.id,
      versionId: version.id,
      userId: params.userId,
      action: params.disposition === "inline" ? "VIEW" : "DOWNLOAD",
    },
  })
  return {
    bytes,
    contentType: stored.contentType,
    originalName: stored.originalName,
    disposition:
      params.disposition === "inline"
        ? contentDispositionInline(stored.originalName)
        : contentDispositionAttachment(stored.originalName),
  }
}
