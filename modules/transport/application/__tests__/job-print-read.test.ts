import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { getJobById, getJobByIdForPrint } from "@/modules/transport/application/job-service"

function jobsReader(branchId: string): UserRole {
  return {
    branchId,
    branchName: branchId,
    roleName: "Custom",
    permissions: { transport_jobs: ["read"] },
  }
}

function noJobsRole(branchId: string): UserRole {
  return {
    branchId,
    branchName: branchId,
    roleName: "Custom",
    permissions: { machines: ["read"] },
  }
}

const JOB = {
  id: "job-1",
  companyId: "company-1",
  branchId: "branch-b",
}

function asDb(findFirst: ReturnType<typeof vi.fn>): PrismaClient {
  return { transportJob: { findFirst } } as unknown as PrismaClient
}

describe("getJobById vs getJobByIdForPrint", () => {
  it("getJobById forbids a reader of another branch", async () => {
    const findFirst = vi.fn().mockResolvedValue(JOB)
    await expect(
      getJobById(asDb(findFirst), {
        id: "job-1",
        companyId: "company-1",
        roles: [jobsReader("branch-a")],
      })
    ).rejects.toThrow(ForbiddenError)
  })

  it("getJobByIdForPrint allows a reader of another branch", async () => {
    const findFirst = vi.fn().mockResolvedValue(JOB)
    await expect(
      getJobByIdForPrint(asDb(findFirst), {
        id: "job-1",
        companyId: "company-1",
        roles: [jobsReader("branch-a")],
      })
    ).resolves.toEqual(JOB)
  })

  it("getJobByIdForPrint forbids a user without transport_jobs read", async () => {
    const findFirst = vi.fn().mockResolvedValue(JOB)
    await expect(
      getJobByIdForPrint(asDb(findFirst), {
        id: "job-1",
        companyId: "company-1",
        roles: [noJobsRole("branch-a")],
      })
    ).rejects.toThrow(ForbiddenError)
  })

  it("getJobByIdForPrint throws NotFoundError when missing", async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    await expect(
      getJobByIdForPrint(asDb(findFirst), {
        id: "job-1",
        companyId: "company-1",
        roles: [jobsReader("branch-a")],
      })
    ).rejects.toThrow(NotFoundError)
  })
})
