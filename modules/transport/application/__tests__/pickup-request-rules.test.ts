import { describe, expect, it } from "vitest"
import {
  canAttachToJob,
  isPickupPublicToken,
  otherStopCustomerCount,
  pickupCargoTypes,
  pickupDisplayStatus,
  pickupRequestToStopDraft,
  pickupUnits,
  submitPickupRequestSchema,
  type PickupStatusSource,
} from "../pickup-request-rules"

const scheduled = new Date("2026-11-06T00:00:00.000Z")
const arrived = new Date("2026-11-06T03:15:00.000Z")

function linked(
  stop: Partial<NonNullable<PickupStatusSource["jobStop"]>> = {},
  job: Partial<NonNullable<PickupStatusSource["jobStop"]>["job"]> = {}
): PickupStatusSource {
  return {
    status: "SUBMITTED",
    jobStop: {
      status: "pending",
      estimatedArrival: null,
      punches: [],
      ...stop,
      job: { status: "assigned", scheduledDate: scheduled, ...job },
    },
  }
}

describe("pickupDisplayStatus", () => {
  it("is cancelled when the request is cancelled", () => {
    expect(pickupDisplayStatus({ ...linked(), status: "CANCELLED" }).status).toBe("cancelled")
  })

  it("waits when no stop is linked", () => {
    expect(pickupDisplayStatus({ status: "SUBMITTED", jobStop: null })).toEqual({
      status: "waiting",
      plannedAt: null,
      pickedAt: null,
    })
  })

  it("goes back to the queue when the stop is skipped or the job is cancelled", () => {
    expect(pickupDisplayStatus(linked({ status: "skipped" })).status).toBe("requeue")
    expect(pickupDisplayStatus(linked({ status: "cancelled" })).status).toBe("requeue")
    expect(pickupDisplayStatus(linked({}, { status: "cancelled" })).status).toBe("requeue")
  })

  it("uses the job date as the plan when the stop has no arrival estimate", () => {
    expect(pickupDisplayStatus(linked())).toEqual({ status: "scheduled", plannedAt: scheduled, pickedAt: null })
  })

  it("prefers the stop arrival estimate for the plan", () => {
    const eta = new Date("2026-11-06T05:00:00.000Z")
    expect(pickupDisplayStatus(linked({ estimatedArrival: eta })).plannedAt).toEqual(eta)
  })

  it("is in progress while the job is running and the stop has no punch", () => {
    expect(pickupDisplayStatus(linked({}, { status: "en_route" })).status).toBe("in_progress")
  })

  it("is picked with the earliest punch at the stop", () => {
    const later = new Date("2026-11-06T03:40:00.000Z")
    const view = pickupDisplayStatus(
      linked({ punches: [{ recordedAt: later }, { recordedAt: arrived }] }, { status: "en_route" })
    )
    expect(view).toEqual({ status: "picked", plannedAt: scheduled, pickedAt: arrived })
  })
})

describe("canAttachToJob", () => {
  const stops = [
    { id: "s1", sequence: 1, status: "pending" },
    { id: "s2", sequence: 2, status: "pending" },
  ]

  it("accepts a job that has not started", () => {
    expect(canAttachToJob({ status: "assigned", stops, punches: [] })).toEqual({ ok: true, running: false })
  })

  it("accepts a running job before the last stop and flags it as running", () => {
    expect(
      canAttachToJob({
        status: "en_route",
        stops,
        punches: [
          { stopId: null, kind: "start" },
          { stopId: "s1", kind: "arrive" },
          { stopId: "s1", kind: "depart" },
        ],
      })
    ).toEqual({ ok: true, running: true })
  })

  it("rejects once the driver reached the last active stop", () => {
    expect(
      canAttachToJob({
        status: "en_route",
        stops,
        punches: [
          { stopId: null, kind: "start" },
          { stopId: "s2", kind: "arrive" },
        ],
      }).ok
    ).toBe(false)
  })

  it("ignores a skipped last stop when finding the last active stop", () => {
    expect(
      canAttachToJob({
        status: "en_route",
        stops: [...stops, { id: "s3", sequence: 3, status: "skipped" }],
        punches: [{ stopId: "s2", kind: "arrive" }],
      }).ok
    ).toBe(false)
  })

  it("rejects finished, under-review, completed and cancelled jobs", () => {
    expect(canAttachToJob({ status: "en_route", stops, punches: [{ stopId: null, kind: "finish" }] }).ok).toBe(false)
    expect(canAttachToJob({ status: "pending_review", stops, punches: [] }).ok).toBe(false)
    expect(canAttachToJob({ status: "completed", stops, punches: [] }).ok).toBe(false)
    expect(canAttachToJob({ status: "cancelled", stops, punches: [] }).ok).toBe(false)
  })
})

describe("pickupRequestToStopDraft", () => {
  const base = {
    requestNo: 12,
    contactName: null,
    phone: null,
    note: null,
    customer: { name: "ร้าน A", address: "1 ถนนสุข", contactName: "คุณบี", phone: "0810000000" },
    lines: [
      { quantity: "10", note: null, cargoType: { name: "ข้าวสาร" }, unit: { name: "กระสอบ" } },
      { quantity: "5.5", note: "แช่เย็น", cargoType: { name: "น้ำตาล" }, unit: { name: "ถุง" } },
    ],
  }

  it("builds the stop from the customer and lists every item in the notes", () => {
    expect(pickupRequestToStopDraft(base)).toEqual({
      customerName: "ร้าน A",
      address: "1 ถนนสุข",
      contactName: "คุณบี",
      contactPhone: "0810000000",
      notes: "คำขอ #12: ข้าวสาร 10 กระสอบ, น้ำตาล 5.5 ถุง (แช่เย็น)",
    })
  })

  it("prefers the contact typed on the request and falls back to a dash address", () => {
    const draft = pickupRequestToStopDraft({
      ...base,
      contactName: "คุณซี",
      phone: "0899999999",
      note: "รับช่วงเช้า",
      customer: { ...base.customer, address: null },
    })
    expect(draft.address).toBe("-")
    expect(draft.contactName).toBe("คุณซี")
    expect(draft.contactPhone).toBe("0899999999")
    expect(draft.notes.endsWith("(รับช่วงเช้า)")).toBe(true)
  })
})

describe("otherStopCustomerCount", () => {
  it("counts distinct customers other than the header", () => {
    expect(
      otherStopCustomerCount("ร้าน A", [
        { customerName: "ร้าน A" },
        { customerName: "ร้าน B" },
        { customerName: " ร้าน b " },
        { customerName: "ร้าน C" },
      ])
    ).toBe(2)
  })

  it("is zero when only the header customer appears", () => {
    expect(otherStopCustomerCount("ร้าน A", [{ customerName: "ร้าน A" }])).toBe(0)
  })
})

describe("submitPickupRequestSchema", () => {
  const line = {
    cargoTypeId: "11111111-1111-4111-8111-111111111111",
    unitId: "22222222-2222-4222-8222-222222222222",
    quantity: 3,
  }

  it("accepts a request with one item", () => {
    expect(submitPickupRequestSchema.safeParse({ lines: [line] }).success).toBe(true)
  })

  it("rejects an empty item list and a zero quantity", () => {
    expect(submitPickupRequestSchema.safeParse({ lines: [] }).success).toBe(false)
    expect(submitPickupRequestSchema.safeParse({ lines: [{ ...line, quantity: 0 }] }).success).toBe(false)
  })

  it("rejects more than 20 items", () => {
    expect(submitPickupRequestSchema.safeParse({ lines: Array(21).fill(line) }).success).toBe(false)
  })
})

describe("pickupCargoTypes", () => {
  it("keeps the three pickup cargo types in a fixed order", () => {
    const picked = pickupCargoTypes([
      { name: "เหล็ก" },
      { name: "ตะกั่ว" },
      { name: "แบตเตอรี่เล็ก" },
      { name: "แบตเตอรี่ใหญ่" },
    ])
    expect(picked.map((type) => type.name)).toEqual(["แบตเตอรี่ใหญ่", "แบตเตอรี่เล็ก", "ตะกั่ว"])
  })
})

describe("pickupUnits", () => {
  it("puts the piece count before kilogram", () => {
    const picked = pickupUnits([
      { code: "LUK", name: "ลูก" },
      { code: "TON", name: "ตัน" },
      { code: "KG", name: "กิโลกรัม" },
    ])
    expect(picked.map((unit) => unit.code)).toEqual(["LUK", "KG"])
  })
})

describe("isPickupPublicToken", () => {
  it("accepts base64url tokens and rejects ids or short strings", () => {
    expect(isPickupPublicToken("abcdefghijklmnopqrstuvwxyz0123456789AB")).toBe(true)
    expect(isPickupPublicToken("short")).toBe(false)
    expect(isPickupPublicToken("../../etc/passwd-aaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false)
  })
})
