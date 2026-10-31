import type { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.fn()

vi.mock("@/lib/auth", () => ({
  auth: () => auth(),
}))

vi.mock("@/shared/db", () => ({
  prisma: {},
}))

vi.mock("@/modules/document_center", () => ({
  createDocument: vi.fn(),
  createDocumentSchema: { safeParse: vi.fn() },
  listDocuments: vi.fn(),
}))

import { POST } from "@/app/api/document-center/documents/route"

function asNext(url: string): NextRequest {
  return new Request(url, { method: "POST" }) as NextRequest
}

describe("document create route auth", () => {
  beforeEach(() => {
    auth.mockReset()
  })

  it("rejects an unauthenticated upload", async () => {
    auth.mockResolvedValue(null)
    const res = await POST(asNext("http://localhost/api/document-center/documents"), { params: Promise.resolve({}) })
    expect(res.status).toBe(401)
  })

  it("rejects a user without create permission", async () => {
    auth.mockResolvedValue({
      user: {
        id: "33333333-3333-3333-3333-333333333333",
        companyId: "11111111-1111-1111-1111-111111111111",
        roles: [{
          branchId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          branchName: "A",
          roleName: "Staff",
          permissions: { documents: ["read"] },
        }],
      },
    })
    const res = await POST(asNext("http://localhost/api/document-center/documents"), { params: Promise.resolve({}) })
    expect(res.status).toBe(403)
  })
})
