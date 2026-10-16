import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { ForbiddenError, NotFoundError, StorageUnavailableError, ValidationError } from "@/lib/errors"
import {
  readExpenseAttachmentFile,
  removeExpenseAttachment,
  uploadExpenseFile,
} from "@/modules/finance/application/expense-service"
import { sha256Hex, type ObjectStorage } from "@/modules/storage"

const COMPANY = "11111111-1111-1111-1111-111111111111"
const OTHER = "22222222-2222-2222-2222-222222222222"
const BRANCH_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const BRANCH_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const EXPENSE = "44444444-4444-4444-4444-444444444444"
const USER = "33333333-3333-3333-3333-333333333333"
const ATTACHMENT = "66666666-6666-6666-6666-666666666666"
const FILE = "55555555-5555-5555-5555-555555555555"

const updateRoles: UserRole[] = [
  {
    branchId: BRANCH_A,
    branchName: "A",
    roleName: "Finance",
    permissions: { expenses: ["create", "read", "update", "delete"] },
  },
]
const readOnlyRoles: UserRole[] = [
  {
    branchId: BRANCH_A,
    branchName: "A",
    roleName: "Viewer",
    permissions: { expenses: ["read"] },
  },
]

const pdf = Buffer.from("%PDF-1.4 hello")

function asDb(db: object): PrismaClient {
  return db as unknown as PrismaClient
}

function memoryStorage(over: Partial<ObjectStorage> = {}): ObjectStorage {
  return {
    bucket: "erp",
    maxUploadBytes: 1024,
    putObject: vi.fn().mockResolvedValue(undefined),
    getObject: vi.fn().mockResolvedValue(pdf),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    headBucket: vi.fn().mockResolvedValue(undefined),
    ...over,
  }
}

function expense(over: { branchId?: string; status?: string } = {}) {
  return { id: EXPENSE, status: over.status ?? "DRAFT", branchId: over.branchId ?? BRANCH_A }
}

describe("uploadExpenseFile", () => {
  it("reports missing S3 configuration without the secret value", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const previous = {
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_REGION: process.env.S3_REGION,
      S3_BUCKET: process.env.S3_BUCKET,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    }
    process.env.S3_SECRET_ACCESS_KEY = "super-secret-value"
    delete process.env.S3_ENDPOINT
    delete process.env.S3_REGION
    delete process.env.S3_BUCKET
    delete process.env.S3_ACCESS_KEY_ID
    try {
      await expect(
        uploadExpenseFile(asDb({ expense: { findFirst: vi.fn().mockResolvedValue(expense()) } }), {
          companyId: COMPANY,
          roles: updateRoles,
          userId: USER,
          id: EXPENSE,
          originalName: "receipt.pdf",
          body: pdf,
        })
      ).rejects.toBeInstanceOf(StorageUnavailableError)
      const dumped = JSON.stringify(spy.mock.calls)
      expect(dumped).toContain("S3_ENDPOINT")
      expect(dumped).not.toContain("super-secret-value")
    } finally {
      spy.mockRestore()
      for (const [key, value] of Object.entries(previous)) {
        if (value == null) delete process.env[key]
        else process.env[key] = value
      }
    }
  })

  it("stores bytes then metadata and does not accept a client object key", async () => {
    const storage = memoryStorage()
    const tx = {
      storedFile: { create: vi.fn().mockResolvedValue({ id: FILE }) },
      expenseAttachment: {
        create: vi.fn().mockResolvedValue({ id: ATTACHMENT }),
        update: vi.fn().mockImplementation(async ({ data }: { data: { fileUrl: string } }) => ({
          id: ATTACHMENT,
          fileUrl: data.fileUrl,
          fileName: "receipt.pdf",
          fileSize: pdf.length,
          storedFileId: FILE,
        })),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    const db = {
      expense: { findFirst: vi.fn().mockResolvedValue(expense()) },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    }
    const result = await uploadExpenseFile(asDb(db), {
      companyId: COMPANY,
      roles: updateRoles,
      userId: USER,
      id: EXPENSE,
      originalName: "receipt.pdf",
      body: pdf,
      storage,
    })
    expect(result.data.storedFileId).toBe(FILE)
    expect(result.data.fileUrl).toBe(`/api/finance/expenses/${EXPENSE}/attachments/${ATTACHMENT}/file`)
    const stored = tx.storedFile.create.mock.calls[0][0].data
    expect(stored.objectKey).toMatch(new RegExp(`^finance/expense/${EXPENSE}/[0-9a-f-]{36}$`))
    expect(stored.sha256).toBe(sha256Hex(pdf))
    expect(stored.bucket).toBe("erp")
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0].data.newValues)).not.toContain("objectKey")
    expect(storage.putObject).toHaveBeenCalledOnce()
  })

  it("deletes the object when the metadata write fails", async () => {
    const storage = memoryStorage()
    const db = {
      expense: { findFirst: vi.fn().mockResolvedValue(expense()) },
      $transaction: vi.fn().mockRejectedValue(new Error("db down")),
    }
    await expect(
      uploadExpenseFile(asDb(db), {
        companyId: COMPANY,
        roles: updateRoles,
        userId: USER,
        id: EXPENSE,
        originalName: "receipt.pdf",
        body: pdf,
        storage,
      })
    ).rejects.toThrow(/db down/)
    expect(storage.deleteObject).toHaveBeenCalledOnce()
  })

  it("does not clean up when the object upload itself fails", async () => {
    const storage = memoryStorage({
      putObject: vi.fn().mockRejectedValue(new StorageUnavailableError()),
    })
    const db = { expense: { findFirst: vi.fn().mockResolvedValue(expense()) }, $transaction: vi.fn() }
    await expect(
      uploadExpenseFile(asDb(db), {
        companyId: COMPANY,
        roles: updateRoles,
        userId: USER,
        id: EXPENSE,
        originalName: "receipt.pdf",
        body: pdf,
        storage,
      })
    ).rejects.toBeInstanceOf(StorageUnavailableError)
    expect(storage.deleteObject).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("rejects a user who cannot update the expense branch", async () => {
    const storage = memoryStorage()
    const db = { expense: { findFirst: vi.fn().mockResolvedValue(expense({ branchId: BRANCH_B })) } }
    await expect(
      uploadExpenseFile(asDb(db), {
        companyId: COMPANY,
        roles: updateRoles,
        userId: USER,
        id: EXPENSE,
        originalName: "receipt.pdf",
        body: pdf,
        storage,
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(storage.putObject).not.toHaveBeenCalled()
  })

  it("hides an expense outside the company", async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const db = { expense: { findFirst } }
    await expect(
      uploadExpenseFile(asDb(db), {
        companyId: COMPANY,
        roles: updateRoles,
        userId: USER,
        id: EXPENSE,
        originalName: "receipt.pdf",
        body: pdf,
        storage: memoryStorage(),
      })
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(findFirst.mock.calls[0][0].where.companyId).toBe(COMPANY)
  })

  it("rejects a reader and a cancelled bill", async () => {
    const storage = memoryStorage()
    await expect(
      uploadExpenseFile(asDb({ expense: { findFirst: vi.fn().mockResolvedValue(expense()) } }), {
        companyId: COMPANY,
        roles: readOnlyRoles,
        userId: USER,
        id: EXPENSE,
        originalName: "receipt.pdf",
        body: pdf,
        storage,
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      uploadExpenseFile(
        asDb({ expense: { findFirst: vi.fn().mockResolvedValue(expense({ status: "CANCELLED" })) } }),
        {
          companyId: COMPANY,
          roles: updateRoles,
          userId: USER,
          id: EXPENSE,
          originalName: "receipt.pdf",
          body: pdf,
          storage,
        }
      )
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe("readExpenseAttachmentFile", () => {
  function reader(storedOver: Record<string, unknown> = {}, bytes = pdf) {
    const storage = memoryStorage({ getObject: vi.fn().mockResolvedValue(bytes) })
    const db = {
      expense: { findFirst: vi.fn().mockResolvedValue(expense()) },
      expenseAttachment: {
        findFirst: vi.fn().mockResolvedValue({
          id: ATTACHMENT,
          storedFile: {
            id: FILE,
            deletedAt: null,
            companyId: COMPANY,
            entityId: EXPENSE,
            module: "finance",
            entityType: "expense",
            objectKey: `finance/expense/${EXPENSE}/${FILE}`,
            sha256: sha256Hex(pdf),
            contentType: "application/pdf",
            originalName: "receipt.pdf",
            sizeBytes: pdf.length,
            ...storedOver,
          },
        }),
      },
    }
    return { db, storage }
  }

  it("returns the stored bytes when the checksum matches", async () => {
    const { db, storage } = reader()
    const file = await readExpenseAttachmentFile(asDb(db), {
      companyId: COMPANY,
      roles: readOnlyRoles,
      id: EXPENSE,
      attachmentId: ATTACHMENT,
      storage,
    })
    expect(file.bytes.equals(pdf)).toBe(true)
    expect(sha256Hex(file.bytes)).toBe(sha256Hex(pdf))
  })

  it("refuses a checksum mismatch and a file from another company", async () => {
    const mismatch = reader({}, Buffer.from("%PDF-1.4 other"))
    await expect(
      readExpenseAttachmentFile(asDb(mismatch.db), {
        companyId: COMPANY,
        roles: readOnlyRoles,
        id: EXPENSE,
        attachmentId: ATTACHMENT,
        storage: mismatch.storage,
      })
    ).rejects.toBeInstanceOf(StorageUnavailableError)

    const foreign = reader({ companyId: OTHER })
    await expect(
      readExpenseAttachmentFile(asDb(foreign.db), {
        companyId: COMPANY,
        roles: readOnlyRoles,
        id: EXPENSE,
        attachmentId: ATTACHMENT,
        storage: foreign.storage,
      })
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(foreign.storage.getObject).not.toHaveBeenCalled()
  })
})

describe("removeExpenseAttachment", () => {
  it("drops the link and soft-deletes metadata without deleting the object", async () => {
    const tx = {
      expenseAttachment: { delete: vi.fn().mockResolvedValue({}) },
      storedFile: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    const db = {
      expense: { findFirst: vi.fn().mockResolvedValue(expense()) },
      expenseAttachment: {
        findFirst: vi.fn().mockResolvedValue({ id: ATTACHMENT, fileName: "receipt.pdf", storedFileId: FILE }),
      },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    }
    await removeExpenseAttachment(asDb(db), {
      companyId: COMPANY,
      roles: updateRoles,
      userId: USER,
      id: EXPENSE,
      attachmentId: ATTACHMENT,
    })
    expect(tx.expenseAttachment.delete).toHaveBeenCalledOnce()
    expect(tx.storedFile.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date)
    expect(tx.storedFile.update.mock.calls[0][0].data).not.toHaveProperty("objectKey")
  })
})
