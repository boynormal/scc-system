import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import {
  authenticateDevice,
  hashDeviceSecret,
  issueDeviceKey,
  parseDeviceKey,
} from "@/modules/hr/application/attendance-device-service"

function fakeDb(device: Record<string, unknown> | null) {
  return {
    attendanceDevice: { findUnique: vi.fn(async () => device) },
  } as unknown as PrismaClient
}

function deviceRow(hash: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "dev-1",
    companyId: "c",
    branchId: "b",
    name: "Front",
    isActive: true,
    apiKeyHash: hash,
    lastSourceRowId: 10,
    branch: { code: "PAD", name: "PAD", timezone: "Asia/Bangkok", isActive: true, deletedAt: null },
    ...overrides,
  }
}

describe("device keys", () => {
  it("issues keys that parse back to their prefix", () => {
    const issued = issueDeviceKey()
    expect(issued.key.startsWith("hip_")).toBe(true)
    expect(parseDeviceKey(`Bearer ${issued.key}`)).toEqual({ prefix: issued.prefix, key: issued.key })
    expect(issued.hash).toBe(hashDeviceSecret(issued.key))
    expect(issued.hash).toHaveLength(64)
  })

  it("rejects malformed keys", () => {
    expect(parseDeviceKey(null)).toBeNull()
    expect(parseDeviceKey("Bearer nope")).toBeNull()
    expect(parseDeviceKey("hip_short_x")).toBeNull()
  })

  it("authenticates a matching active device", async () => {
    const issued = issueDeviceKey()
    const device = await authenticateDevice(fakeDb(deviceRow(issued.hash)), `Bearer ${issued.key}`)
    expect(device).toMatchObject({ id: "dev-1", branchId: "b", lastSourceRowId: 10 })
  })

  it("rejects a key whose secret does not match", async () => {
    const issued = issueDeviceKey()
    const other = issueDeviceKey()
    const forged = `hip_${issued.prefix}_${other.key.slice("hip_".length + other.prefix.length + 1)}`
    await expect(authenticateDevice(fakeDb(deviceRow(issued.hash)), `Bearer ${forged}`)).rejects.toMatchObject({ status: 401 })
  })

  it("rejects an inactive device", async () => {
    const issued = issueDeviceKey()
    await expect(
      authenticateDevice(fakeDb(deviceRow(issued.hash, { isActive: false })), `Bearer ${issued.key}`)
    ).rejects.toMatchObject({ status: 401, message: "เครื่องสแกนนี้ถูกปิดใช้งาน" })
  })

  it("rejects an unknown prefix", async () => {
    const issued = issueDeviceKey()
    await expect(authenticateDevice(fakeDb(null), `Bearer ${issued.key}`)).rejects.toMatchObject({ status: 401 })
  })
})
