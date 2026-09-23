import { describe, expect, it } from "vitest"
import {
  buildLegs,
  canGraceFillOdometer,
  canSkipStop,
  GPS_SNAPSHOT_MAX_AGE_MS,
  isFreshGps,
  kindsForStop,
  LEG_MAX_DWELL_MINUTES,
  LEG_MIN_AVERAGE_SPEED_KMH,
  nextPunch,
  punchRecordedTooSoon,
  PUNCH_MIN_GAP_MS,
  usesTripBookends,
  type PunchStop,
} from "@/modules/transport/application/job-punch-rules"

const stops: PunchStop[] = [
  { id: "origin", sequence: 1, status: "pending" },
  { id: "drop", sequence: 2, status: "pending" },
  { id: "return", sequence: 3, status: "pending" },
]

const oneStop: PunchStop[] = [{ id: "drop", sequence: 1, status: "pending" }]

describe("job punch sequence", () => {
  it("books a one-stop delivery as start, arrive, depart, finish", () => {
    expect(usesTripBookends([])).toBe(true)
    expect(nextPunch(oneStop, [])).toEqual({ stopId: null, kind: "start" })
    expect(nextPunch(oneStop, [{ stopId: null, kind: "start" }])).toEqual({
      stopId: "drop",
      kind: "arrive",
    })
    expect(
      nextPunch(oneStop, [
        { stopId: null, kind: "start" },
        { stopId: "drop", kind: "arrive" },
      ])
    ).toEqual({ stopId: "drop", kind: "depart" })
    expect(
      nextPunch(oneStop, [
        { stopId: null, kind: "start" },
        { stopId: "drop", kind: "arrive" },
        { stopId: "drop", kind: "depart" },
      ])
    ).toEqual({ stopId: null, kind: "finish" })
    expect(
      nextPunch(oneStop, [
        { stopId: null, kind: "start" },
        { stopId: "drop", kind: "arrive" },
        { stopId: "drop", kind: "depart" },
        { stopId: null, kind: "finish" },
      ])
    ).toBeNull()
    expect(kindsForStop(oneStop, "drop", [])).toEqual(["arrive", "depart"])
  })

  it("walks every delivery stop between one start and one finish", () => {
    const started = [{ stopId: null, kind: "start" as const }]
    expect(nextPunch(stops, started)).toEqual({ stopId: "origin", kind: "arrive" })
    expect(
      nextPunch(stops, [
        ...started,
        { stopId: "origin", kind: "arrive" },
        { stopId: "origin", kind: "depart" },
      ])
    ).toEqual({ stopId: "drop", kind: "arrive" })
    expect(kindsForStop(stops, "return", started)).toEqual(["arrive", "depart"])
  })

  it("keeps a job that already has stop punches on the old sequence", () => {
    const started = [{ stopId: "origin", kind: "depart" as const }]
    expect(usesTripBookends(started)).toBe(false)
    expect(nextPunch(stops, started)).toEqual({ stopId: "drop", kind: "arrive" })
    expect(
      nextPunch(stops, [
        { stopId: "origin", kind: "depart" },
        { stopId: "drop", kind: "arrive" },
        { stopId: "drop", kind: "depart" },
      ])
    ).toEqual({ stopId: "return", kind: "arrive" })
    expect(
      nextPunch(stops, [
        { stopId: "origin", kind: "depart" },
        { stopId: "drop", kind: "arrive" },
        { stopId: "drop", kind: "depart" },
        { stopId: "return", kind: "arrive" },
      ])
    ).toBeNull()
    expect(kindsForStop(stops, "origin", started)).toEqual(["depart"])
    expect(kindsForStop(stops, "drop", started)).toEqual(["arrive", "depart"])
    expect(kindsForStop(stops, "return", started)).toEqual(["arrive"])
  })

  it("skips only the current middle stop", () => {
    const readyForMiddle = [
      { stopId: null, kind: "start" as const },
      { stopId: "origin", kind: "arrive" as const },
      { stopId: "origin", kind: "depart" as const },
    ]
    expect(canSkipStop(stops, "origin", readyForMiddle)).toBe(false)
    expect(canSkipStop(stops, "return", readyForMiddle)).toBe(false)
    expect(canSkipStop(stops, "drop", [{ stopId: null, kind: "start" }])).toBe(false)
    expect(canSkipStop(stops, "drop", readyForMiddle)).toBe(true)
    const skipped = stops.map((stop) => (stop.id === "drop" ? { ...stop, status: "skipped" } : stop))
    expect(kindsForStop(skipped, "drop", readyForMiddle)).toBeNull()
    expect(nextPunch(skipped, readyForMiddle)).toEqual({ stopId: "return", kind: "arrive" })

    const legacy = [{ stopId: "origin", kind: "depart" as const }]
    expect(canSkipStop(stops, "drop", legacy)).toBe(true)
    const legacySkipped = stops.map((stop) => (stop.id === "drop" ? { ...stop, status: "skipped" } : stop))
    expect(nextPunch(legacySkipped, legacy)).toEqual({ stopId: "return", kind: "arrive" })
  })

  it("rejects a following punch inside the gap and allows one after it", () => {
    const previous = new Date("2026-09-23T08:00:00.000Z")
    expect(punchRecordedTooSoon(null, previous)).toBe(false)
    expect(punchRecordedTooSoon(previous, new Date(previous.getTime() + PUNCH_MIN_GAP_MS - 1))).toBe(true)
    expect(punchRecordedTooSoon(previous, new Date(previous.getTime() + PUNCH_MIN_GAP_MS))).toBe(false)
  })

  it("copies a fresh odometer and leaves a late gap empty", () => {
    const recordedAt = new Date("2026-09-23T08:00:00.000Z")
    expect(isFreshGps(new Date(recordedAt.getTime() - 60_000), recordedAt)).toBe(true)
    expect(isFreshGps(new Date(recordedAt.getTime() - GPS_SNAPSHOT_MAX_AGE_MS - 1), recordedAt)).toBe(false)
    expect(canGraceFillOdometer(recordedAt, new Date(recordedAt.getTime() + 60_000))).toBe(true)
    expect(canGraceFillOdometer(recordedAt, new Date(recordedAt.getTime() + GPS_SNAPSHOT_MAX_AGE_MS + 1))).toBe(
      false
    )
  })

  it("computes minutes and km only when both punches have mileage", () => {
    const legs = buildLegs([
      { stopId: "origin", kind: "depart", recordedAt: new Date("2026-09-23T08:00:00.000Z"), odometerKm: 1000 },
      { stopId: "drop", kind: "arrive", recordedAt: new Date("2026-09-23T10:00:00.000Z"), odometerKm: null },
    ])
    expect(legs).toEqual([
      {
        fromStopId: "origin",
        fromKind: "depart",
        toStopId: "drop",
        toKind: "arrive",
        minutes: 120,
        km: null,
        kind: "travel",
        flag: null,
      },
    ])
  })

  it("flags a dwell leg that runs longer than the limit", () => {
    const start = new Date("2026-09-23T08:00:00.000Z")
    const [normal] = buildLegs([
      { stopId: "drop", kind: "arrive", recordedAt: start, odometerKm: 1000 },
      {
        stopId: "drop",
        kind: "depart",
        recordedAt: new Date(start.getTime() + LEG_MAX_DWELL_MINUTES * 60_000),
        odometerKm: 1000,
      },
    ])
    expect(normal.kind).toBe("dwell")
    expect(normal.flag).toBeNull()

    const [tooLong] = buildLegs([
      { stopId: "drop", kind: "arrive", recordedAt: start, odometerKm: 1000 },
      {
        stopId: "drop",
        kind: "depart",
        recordedAt: new Date(start.getTime() + (LEG_MAX_DWELL_MINUTES + 1) * 60_000),
        odometerKm: 1000,
      },
    ])
    expect(tooLong.kind).toBe("dwell")
    expect(tooLong.flag).toBe("long_dwell")
  })

  it("flags a travel leg slower than the minimum average speed", () => {
    const start = new Date("2026-09-23T08:00:00.000Z")
    const oneHourLater = new Date(start.getTime() + 60 * 60_000)

    const [atLimit] = buildLegs([
      { stopId: "origin", kind: "depart", recordedAt: start, odometerKm: 0 },
      { stopId: "drop", kind: "arrive", recordedAt: oneHourLater, odometerKm: LEG_MIN_AVERAGE_SPEED_KMH },
    ])
    expect(atLimit.kind).toBe("travel")
    expect(atLimit.flag).toBeNull()

    const [tooSlow] = buildLegs([
      { stopId: "origin", kind: "depart", recordedAt: start, odometerKm: 0 },
      { stopId: "drop", kind: "arrive", recordedAt: oneHourLater, odometerKm: LEG_MIN_AVERAGE_SPEED_KMH - 1 },
    ])
    expect(tooSlow.kind).toBe("travel")
    expect(tooSlow.flag).toBe("slow_travel")
  })

  it("treats start-to-stop as travel and the same stop as dwell", () => {
    const legs = buildLegs([
      { stopId: null, kind: "start", recordedAt: new Date("2026-09-23T08:00:00.000Z"), odometerKm: 1000 },
      { stopId: "drop", kind: "arrive", recordedAt: new Date("2026-09-23T09:00:00.000Z"), odometerKm: 1040 },
      { stopId: "drop", kind: "depart", recordedAt: new Date("2026-09-23T09:30:00.000Z"), odometerKm: 1040 },
      { stopId: null, kind: "finish", recordedAt: new Date("2026-09-23T10:30:00.000Z"), odometerKm: 1080 },
    ])
    expect(legs.map((leg) => leg.kind)).toEqual(["travel", "dwell", "travel"])
    expect(legs[0]).toMatchObject({ fromStopId: null, fromKind: "start", toStopId: "drop", km: 40, flag: null })
    expect(legs[2]).toMatchObject({ toStopId: null, toKind: "finish", km: 40 })
  })

  it("never flags a travel leg with no odometer reading", () => {
    const [leg] = buildLegs([
      { stopId: "origin", kind: "depart", recordedAt: new Date("2026-09-23T08:00:00.000Z"), odometerKm: null },
      { stopId: "drop", kind: "arrive", recordedAt: new Date("2026-09-23T10:00:00.000Z"), odometerKm: null },
    ])
    expect(leg.flag).toBeNull()
  })
})
