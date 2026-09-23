export const GPS_SNAPSHOT_MAX_AGE_MS = 2 * 60 * 1000
/** Ignore a following punch until this long after the previous one, so a second tap cannot record the next step. */
export const PUNCH_MIN_GAP_MS = 15_000

export function punchRecordedTooSoon(previousRecordedAt: Date | null, now: Date) {
  if (!previousRecordedAt) return false
  const elapsed = now.getTime() - previousRecordedAt.getTime()
  return elapsed >= 0 && elapsed < PUNCH_MIN_GAP_MS
}

export type PunchKind = "start" | "finish" | "arrive" | "depart"
export type StopPunchKind = "arrive" | "depart"

export type PunchStop = {
  id: string
  sequence: number
  status: string
}

export type PunchRef = {
  stopId: string | null
  kind: PunchKind
}

export type PunchStep = {
  stopId: string | null
  kind: PunchKind
}

export type PunchRecord = PunchRef & {
  recordedAt: Date
  odometerKm: number | null
}

export const LEG_MAX_DWELL_MINUTES = 120
export const LEG_MIN_AVERAGE_SPEED_KMH = 15

export type JobLegKind = "travel" | "dwell"
export type JobLegFlag = "long_dwell" | "slow_travel" | null

export type JobLeg = {
  fromStopId: string | null
  fromKind: PunchKind
  toStopId: string | null
  toKind: PunchKind
  minutes: number
  km: number | null
  kind: JobLegKind
  flag: JobLegFlag
}

export function isInactiveStop(status: string) {
  return status === "skipped" || status === "cancelled"
}

export function orderedActiveStops(stops: PunchStop[]) {
  return [...stops]
    .filter((stop) => !isInactiveStop(stop.status))
    .sort((a, b) => a.sequence - b.sequence)
}

/** Jobs with no punches, or an explicit start/finish, use trip bookends. */
export function usesTripBookends(punches: { kind: PunchKind }[]) {
  if (punches.length === 0) return true
  return punches.some((punch) => punch.kind === "start" || punch.kind === "finish")
}

export function kindsForStop(
  stops: PunchStop[],
  stopId: string,
  punches: { kind: PunchKind }[]
): StopPunchKind[] | null {
  const active = orderedActiveStops(stops)
  const index = active.findIndex((stop) => stop.id === stopId)
  if (index < 0) return null
  if (usesTripBookends(punches)) return ["arrive", "depart"]
  return legacyRequiredKinds(index, active.length)
}

function legacyRequiredKinds(index: number, count: number): StopPunchKind[] {
  if (count <= 1) return ["depart", "arrive"]
  if (index === 0) return ["depart"]
  if (index === count - 1) return ["arrive"]
  return ["arrive", "depart"]
}

export function nextPunch(stops: PunchStop[], punches: PunchRef[]): PunchStep | null {
  if (!usesTripBookends(punches)) return legacyNextPunch(stops, punches)

  if (!punches.some((punch) => punch.kind === "start")) return { stopId: null, kind: "start" }

  const done = new Set(
    punches
      .filter((punch) => punch.stopId)
      .map((punch) => `${punch.stopId}:${punch.kind}`)
  )
  for (const stop of orderedActiveStops(stops)) {
    for (const kind of ["arrive", "depart"] as const) {
      if (!done.has(`${stop.id}:${kind}`)) return { stopId: stop.id, kind }
    }
  }

  if (!punches.some((punch) => punch.kind === "finish")) return { stopId: null, kind: "finish" }
  return null
}

function legacyNextPunch(stops: PunchStop[], punches: PunchRef[]): PunchStep | null {
  const active = orderedActiveStops(stops)
  const done = new Set(punches.map((punch) => `${punch.stopId}:${punch.kind}`))
  for (let index = 0; index < active.length; index++) {
    const stop = active[index]!
    for (const kind of legacyRequiredKinds(index, active.length)) {
      if (!done.has(`${stop.id}:${kind}`)) return { stopId: stop.id, kind }
    }
  }
  return null
}

export function canSkipStop(stops: PunchStop[], stopId: string, punches: PunchRef[]) {
  const active = orderedActiveStops(stops)
  const index = active.findIndex((stop) => stop.id === stopId)
  if (index <= 0 || index >= active.length - 1) return false
  if (punches.some((punch) => punch.stopId === stopId)) return false
  return nextPunch(stops, punches)?.stopId === stopId
}

export function isFreshGps(readAt: Date | null, now: Date) {
  if (!readAt) return false
  const age = now.getTime() - readAt.getTime()
  return age >= 0 && age <= GPS_SNAPSHOT_MAX_AGE_MS
}

export function canGraceFillOdometer(recordedAt: Date, gpsReadAt: Date) {
  return Math.abs(gpsReadAt.getTime() - recordedAt.getTime()) <= GPS_SNAPSHOT_MAX_AGE_MS
}

function flagLeg(kind: JobLegKind, minutes: number, km: number | null): JobLegFlag {
  if (kind === "dwell") {
    return minutes > LEG_MAX_DWELL_MINUTES ? "long_dwell" : null
  }
  if (km == null || minutes <= 0) return null
  const averageSpeedKmh = km / (minutes / 60)
  return averageSpeedKmh < LEG_MIN_AVERAGE_SPEED_KMH ? "slow_travel" : null
}

export function buildLegs(punches: PunchRecord[]): JobLeg[] {
  const sorted = [...punches].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
  const legs: JobLeg[] = []
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1]!
    const current = sorted[index]!
    const minutes = Math.round((current.recordedAt.getTime() - previous.recordedAt.getTime()) / 60000)
    const km =
      previous.odometerKm != null && current.odometerKm != null
        ? Math.round((current.odometerKm - previous.odometerKm) * 100) / 100
        : null
    const kind: JobLegKind =
      previous.stopId != null && previous.stopId === current.stopId ? "dwell" : "travel"
    legs.push({
      fromStopId: previous.stopId,
      fromKind: previous.kind,
      toStopId: current.stopId,
      toKind: current.kind,
      minutes,
      km,
      kind,
      flag: flagLeg(kind, minutes, km),
    })
  }
  return legs
}

/** Thai warning text for a flagged leg, or null when the leg is normal. */
export function describeLegFlag(leg: Pick<JobLeg, "flag" | "minutes" | "km">): string | null {
  if (leg.flag === "long_dwell") {
    return `จอดนาน ${leg.minutes} นาที เกิน ${LEG_MAX_DWELL_MINUTES} นาที`
  }
  if (leg.flag === "slow_travel" && leg.km != null && leg.minutes > 0) {
    const averageSpeedKmh = Math.round((leg.km / (leg.minutes / 60)) * 10) / 10
    return `เฉลี่ย ${averageSpeedKmh.toLocaleString()} กม./ชม. ต่ำกว่า ${LEG_MIN_AVERAGE_SPEED_KMH} กม./ชม.`
  }
  return null
}

export function legEndpointLabel(
  kind: PunchKind,
  stopId: string | null,
  stopName: (id: string) => string
) {
  if (kind === "start") return "เริ่มงาน"
  if (kind === "finish") return "จบงาน"
  return stopId ? stopName(stopId) : "จุด"
}

export function phoneDigits(phone: string | null | undefined) {
  return (phone ?? "").replace(/\D/g, "")
}

export function parseOdometer(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value
  if (typeof value !== "string") return null
  const parsed = Number(value.replace(/,/g, "").trim())
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}
