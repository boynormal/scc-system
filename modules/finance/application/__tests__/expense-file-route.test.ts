import type { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.fn()

vi.mock("@/lib/auth", () => ({
  auth: () => auth(),
}))

vi.mock("@/shared/db", () => ({
  prisma: {},
}))

vi.mock("@/modules/finance", () => ({
  uploadExpenseFile: vi.fn(),
  readExpenseAttachmentFile: vi.fn(),
  removeExpenseAttachment: vi.fn(),
}))

import { POST } from "@/app/api/finance/expenses/[id]/files/route"

function asNext(url: string): NextRequest {
  return new Request(url, { method: "POST" }) as NextRequest
}

const ctx = { params: Promise.resolve({ id: "44444444-4444-4444-4444-444444444444" }) }

describe("expense file route auth", () => {
  beforeEach(() => {
    auth.mockReset()
  })

  it("rejects an unauthenticated upload", async () => {
    auth.mockResolvedValue(null)
    const res = await POST(asNext("http://localhost/api/finance/expenses/x/files"), ctx)
    expect(res.status).toBe(401)
  })

  it("rejects a user without expense update permission", async () => {
    auth.mockResolvedValue({
      user: {
        id: "33333333-3333-3333-3333-333333333333",
        companyId: "11111111-1111-1111-1111-111111111111",
        roles: [
          {
            branchId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            branchName: "A",
            roleName: "Viewer",
            permissions: { expenses: ["read"] },
          },
        ],
      },
    })
    const res = await POST(asNext("http://localhost/api/finance/expenses/x/files"), ctx)
    expect(res.status).toBe(403)
  })
})
