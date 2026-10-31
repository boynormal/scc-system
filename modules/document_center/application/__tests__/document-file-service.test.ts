import type { PrismaClient } from "@prisma/client"
import { describe, expect, it, vi } from "vitest"
import { ValidationError, NotFoundError, StorageUnavailableError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import type { ObjectStorage } from "@/modules/storage"
import { createDocument, readDocumentFile, addDocumentVersion } from "@/modules/document_center/application/document-file-service"
import { deleteCategory } from "@/modules/document_center/application/category-service"
import { setFavorite, updateDocument } from "@/modules/document_center/application/document-service"

const COMPANY = "11111111-1111-1111-1111-111111111111"
const BRANCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const OTHER = "22222222-2222-2222-2222-222222222222"
const USER = "33333333-3333-3333-3333-333333333333"
const CATEGORY = "44444444-4444-4444-4444-444444444444"
const TYPE = "55555555-5555-5555-5555-555555555555"

function asDb(db: object): PrismaClient {
  return db as unknown as PrismaClient
}

function roles(): UserRole[] {
  return [{
    branchId: BRANCH,
    branchName: "A",
    roleName: "Staff",
    permissions: { documents: ["create", "read", "update", "delete"], document_masters: ["delete"] },
  }]
}

function memoryStorage(over: Partial<ObjectStorage> = {}): ObjectStorage {
  return {
    bucket: "erp",
    maxUploadBytes: 1024,
    putObject: vi.fn().mockResolvedValue(undefined),
    getObject: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 ok")),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    headBucket: vi.fn().mockResolvedValue(undefined),
    ...over,
  }
}

function companyDb() {
  return { company: { findUnique: vi.fn().mockResolvedValue({ settings: null }) } }
}

describe("document files", () => {
  it("removes the object when the metadata transaction fails", async () => {
    const storage = memoryStorage()
    const db = {
      ...companyDb(),
      docCenterCategory: { findFirst: vi.fn().mockResolvedValue({ id: CATEGORY }) },
      docCenterType: { findFirst: vi.fn().mockResolvedValue({ id: TYPE }) },
      branch: { findFirst: vi.fn().mockResolvedValue({ id: BRANCH }) },
      $transaction: vi.fn().mockRejectedValue(new Error("db down")),
    }
    await expect(
      createDocument(asDb(db), {
        companyId: COMPANY,
        roles: roles(),
        userId: USER,
        input: {
          documentName: "คู่มือ",
          categoryId: CATEGORY,
          typeId: TYPE,
          branchId: BRANCH,
        },
        originalName: "manual.pdf",
        body: Buffer.from("%PDF-1.4 ok"),
        storage,
      })
    ).rejects.toThrow("db down")
    expect(storage.deleteObject).toHaveBeenCalledOnce()
  })

  it("assigns a generated code and ignores a code sent by the client", async () => {
    const storage = memoryStorage()
    const create = vi.fn().mockResolvedValue({})
    const db = {
      ...companyDb(),
      docCenterCategory: { findFirst: vi.fn().mockResolvedValue({ id: CATEGORY }) },
      docCenterType: { findFirst: vi.fn().mockResolvedValue({ id: TYPE }) },
      branch: { findFirst: vi.fn().mockResolvedValue({ id: BRANCH }) },
      $transaction: vi.fn(async (fn: (tx: object) => Promise<unknown>) =>
        fn({
          docCenterDocument: { create, update: vi.fn().mockResolvedValue({}) },
          storedFile: { create: vi.fn().mockResolvedValue({}) },
          docCenterVersion: { create: vi.fn().mockResolvedValue({ id: "99999999-9999-9999-9999-999999999999" }) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        })
      ),
    }
    await createDocument(asDb(db), {
      companyId: COMPANY,
      roles: roles(),
      userId: USER,
      input: {
        documentCode: "HR-WI-001",
        documentName: "คู่มือ",
        categoryId: CATEGORY,
        typeId: TYPE,
        branchId: BRANCH,
      },
      originalName: "manual.pdf",
      body: Buffer.from("%PDF-1.4 ok"),
      storage,
    })
    const saved = create.mock.calls[0][0].data.documentCode as string
    expect(saved).toMatch(/^DC-\d{6}-[A-Z0-9]{4}$/)
    expect(saved).not.toBe("HR-WI-001")
    expect(storage.deleteObject).not.toHaveBeenCalled()
  })

  it("retries once when two version uploads collide", async () => {
    const storage = memoryStorage()
    let calls = 0
    const versionId = "99999999-9999-9999-9999-999999999999"
    const tx = {
      docCenterVersion: {
        aggregate: vi.fn().mockResolvedValue({ _max: { versionNumber: 1 } }),
        create: vi.fn().mockImplementation(async () => {
          calls += 1
          if (calls === 1) {
            const err = new Error("unique") as Error & { code: string }
            err.code = "P2002"
            throw err
          }
          return { id: versionId }
        }),
      },
      storedFile: { create: vi.fn().mockResolvedValue({}) },
      docCenterDocument: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    const db = {
      ...companyDb(),
      docCenterDocument: {
        findFirst: vi.fn().mockResolvedValue({
          id: "66666666-6666-6666-6666-666666666666",
          branchId: BRANCH,
          deletedAt: null,
          currentVersionId: null,
        }),
      },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    }
    const result = await addDocumentVersion(asDb(db), {
      companyId: COMPANY,
      roles: roles(),
      userId: USER,
      id: "66666666-6666-6666-6666-666666666666",
      originalName: "manual.pdf",
      body: Buffer.from("%PDF-1.4 ok"),
      changeNote: "แก้คำผิด",
      storage,
    })
    expect(result.data.versionId).toBe(versionId)
    expect(calls).toBe(2)
    expect(storage.deleteObject).not.toHaveBeenCalled()
  })

  it("does not return a file from another company", async () => {
    const db = {
      ...companyDb(),
      docCenterDocument: { findFirst: vi.fn().mockResolvedValue(null) },
    }
    await expect(
      readDocumentFile(asDb(db), {
        companyId: OTHER,
        roles: roles(),
        userId: USER,
        id: "66666666-6666-6666-6666-666666666666",
        versionId: "77777777-7777-7777-7777-777777777777",
        disposition: "attachment",
        storage: memoryStorage(),
      })
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("refuses inline preview for a word file and does not log it", async () => {
    const create = vi.fn()
    const db = {
      ...companyDb(),
      docCenterDocument: { findFirst: vi.fn().mockResolvedValue({ id: "66666666-6666-6666-6666-666666666666", companyId: COMPANY }) },
      docCenterVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: "77777777-7777-7777-7777-777777777777",
          storedFile: {
            id: "88888888-8888-8888-8888-888888888888",
            deletedAt: null,
            companyId: COMPANY,
            entityId: "66666666-6666-6666-6666-666666666666",
            module: "document_center",
            entityType: "document",
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            originalName: "a.docx",
            objectKey: "document_center/document/x/y",
            sha256: "abc",
          },
        }),
      },
      docCenterAccessLog: { create },
    }
    await expect(
      readDocumentFile(asDb(db), {
        companyId: COMPANY,
        roles: roles(),
        userId: USER,
        id: "66666666-6666-6666-6666-666666666666",
        versionId: "77777777-7777-7777-7777-777777777777",
        disposition: "inline",
        storage: memoryStorage(),
      })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(create).not.toHaveBeenCalled()
  })

  it("rejects a checksum mismatch", async () => {
    const db = {
      ...companyDb(),
      docCenterDocument: { findFirst: vi.fn().mockResolvedValue({ id: "66666666-6666-6666-6666-666666666666" }) },
      docCenterVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: "77777777-7777-7777-7777-777777777777",
          storedFile: {
            id: "88888888-8888-8888-8888-888888888888",
            deletedAt: null,
            companyId: COMPANY,
            entityId: "66666666-6666-6666-6666-666666666666",
            module: "document_center",
            entityType: "document",
            contentType: "application/pdf",
            originalName: "a.pdf",
            objectKey: "k",
            sha256: "deadbeef",
          },
        }),
      },
      docCenterAccessLog: { create: vi.fn() },
    }
    await expect(
      readDocumentFile(asDb(db), {
        companyId: COMPANY,
        roles: roles(),
        userId: USER,
        id: "66666666-6666-6666-6666-666666666666",
        versionId: "77777777-7777-7777-7777-777777777777",
        disposition: "attachment",
        storage: memoryStorage(),
      })
    ).rejects.toBeInstanceOf(StorageUnavailableError)
  })
})

describe("document code stays automatic", () => {
  it("does not change the code when metadata is edited", async () => {
    const update = vi.fn().mockResolvedValue({})
    const existing = {
      id: "66666666-6666-6666-6666-666666666666",
      deletedAt: null,
      documentCode: "DC-202610-AAAA",
      documentName: "เดิม",
      status: "ACTIVE",
      effectiveDate: null,
      expiryDate: null,
    }
    const db = {
      ...companyDb(),
      docCenterDocument: {
        findFirst: vi.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(null),
      },
      $transaction: vi.fn(async (fn: (tx: object) => Promise<unknown>) =>
        fn({
          docCenterDocument: { update },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        })
      ),
    }
    await expect(
      updateDocument(asDb(db), {
        companyId: COMPANY,
        roles: roles(),
        userId: USER,
        id: existing.id,
        input: { documentName: "ใหม่", documentCode: "HR-WI-001" },
      })
    ).rejects.toBeInstanceOf(NotFoundError)
    const saved = update.mock.calls[0][0].data as { documentCode?: string; documentName?: string }
    expect(saved.documentCode).toBeUndefined()
    expect(saved.documentName).toBe("ใหม่")
  })
})

describe("document masters and favorites", () => {
  it("refuses to delete a category that still has documents", async () => {
    const db = {
      docCenterCategory: {
        findFirst: vi.fn().mockResolvedValue({ id: CATEGORY }),
        count: vi.fn().mockResolvedValue(0),
      },
      docCenterDocument: { count: vi.fn().mockResolvedValue(2) },
    }
    await expect(
      deleteCategory(asDb(db), { companyId: COMPANY, roles: roles(), id: CATEGORY })
    ).rejects.toThrow(/ยังมีเอกสาร/)
  })

  it("does not favorite a document outside the caller scope", async () => {
    const db = {
      ...companyDb(),
      docCenterDocument: { findFirst: vi.fn().mockResolvedValue(null) },
    }
    await expect(
      setFavorite(asDb(db), {
        companyId: COMPANY,
        roles: roles(),
        userId: USER,
        id: "99999999-9999-9999-9999-999999999999",
        favorite: true,
      })
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})
