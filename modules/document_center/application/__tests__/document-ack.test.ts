import type { PrismaClient } from "@prisma/client"
import { describe, expect, it, vi } from "vitest"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { acknowledgeDocument } from "@/modules/document_center/application/document-service"

const COMPANY = "11111111-1111-1111-1111-111111111111"
const BRANCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const USER = "33333333-3333-3333-3333-333333333333"
const DOC = "66666666-6666-6666-6666-666666666666"
const VERSION = "77777777-7777-7777-7777-777777777777"
const NEXT = "88888888-8888-8888-8888-888888888888"

function asDb(db: object): PrismaClient {
  return db as unknown as PrismaClient
}

function roles(actions: Array<"read" | "create" | "update" | "delete" | "approve"> = ["read"]): UserRole[] {
  return [{
    branchId: BRANCH,
    branchName: "A",
    roleName: "Staff",
    permissions: { documents: actions },
  }]
}

function dbFor(doc: { requiresAcknowledgement: boolean; currentVersionId: string | null }, ack: { createdAt: Date } | null) {
  return {
    company: { findUnique: vi.fn().mockResolvedValue({ settings: null }) },
    docCenterDocument: {
      findFirst: vi.fn().mockResolvedValue({
        id: DOC,
        deletedAt: null,
        ...doc,
      }),
    },
    docCenterAcknowledgement: {
      findUnique: vi.fn().mockResolvedValue(ack),
      create: vi.fn().mockResolvedValue({ createdAt: new Date("2026-10-31T08:00:00.000Z") }),
    },
  }
}

describe("document acknowledgement", () => {
  it("records the current user, time, and current version", async () => {
    const db = dbFor({ requiresAcknowledgement: true, currentVersionId: VERSION }, null)
    const result = await acknowledgeDocument(asDb(db), {
      companyId: COMPANY,
      roles: roles(),
      userId: USER,
      id: DOC,
    })
    expect(result.data.already).toBe(false)
    expect(result.data.acknowledgedAt).toBe("2026-10-31T08:00:00.000Z")
    expect(db.docCenterAcknowledgement.create).toHaveBeenCalledWith({
      data: { documentId: DOC, versionId: VERSION, userId: USER },
    })
  })

  it("does not add another row when the same version is acknowledged again", async () => {
    const db = dbFor(
      { requiresAcknowledgement: true, currentVersionId: VERSION },
      { createdAt: new Date("2026-10-31T08:00:00.000Z") }
    )
    const result = await acknowledgeDocument(asDb(db), {
      companyId: COMPANY,
      roles: roles(),
      userId: USER,
      id: DOC,
    })
    expect(result.data.already).toBe(true)
    expect(db.docCenterAcknowledgement.create).not.toHaveBeenCalled()
  })

  it("asks again after a new version becomes current", async () => {
    const db = dbFor({ requiresAcknowledgement: true, currentVersionId: NEXT }, null)
    await acknowledgeDocument(asDb(db), {
      companyId: COMPANY,
      roles: roles(),
      userId: USER,
      id: DOC,
    })
    expect(db.docCenterAcknowledgement.create).toHaveBeenCalledWith({
      data: { documentId: DOC, versionId: NEXT, userId: USER },
    })
  })

  it("rejects a document that does not require acknowledgement and a user who cannot read", async () => {
    const optional = dbFor({ requiresAcknowledgement: false, currentVersionId: VERSION }, null)
    await expect(
      acknowledgeDocument(asDb(optional), { companyId: COMPANY, roles: roles(), userId: USER, id: DOC })
    ).rejects.toBeInstanceOf(ValidationError)

    const hidden = dbFor({ requiresAcknowledgement: true, currentVersionId: VERSION }, null)
    await expect(
      acknowledgeDocument(asDb(hidden), { companyId: COMPANY, roles: roles([]), userId: USER, id: DOC })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})
