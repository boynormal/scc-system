/** กฎบริษัทมาตรฐาน: เข้า 08:00 เลิก 17:00 พัก 12:00–13:00 เกณฑ์ขึ้นรายการ OT 30 นาที */
export const COMPANY_WORK_RULE = {
  startMinute: 8 * 60,
  endMinute: 17 * 60,
  breakStartMinute: 12 * 60,
  breakEndMinute: 13 * 60,
  otThresholdMinutes: 30,
} as const

export type OtCandidate = {
  at: Date
  minutes: number
  needsConfirm: true
}

export type ManHourResult = {
  manMinutes: number
  /** นาทีที่สแกนแรกช้ากว่า 08:00 มาตรงเวลาหรือก่อนเวลาเป็น 0 */
  lateMinutes: number
  otBefore: OtCandidate | null
  otAfter: OtCandidate | null
}

export type OtDecisionStatus = "PENDING" | "OT" | "NOT_OT"

export type OtRowView = {
  at: Date
  minutes: number
  status: OtDecisionStatus
}

export type StoredOtDecision = {
  side: "BEFORE" | "AFTER"
  punchAt: Date
  decision: "OT" | "NOT_OT"
  otMinutes: number
}

export function isBeforeCompanyEnd(at: Date, timeZone: string): boolean {
  return localMinutes(at, timeZone) < COMPANY_WORK_RULE.endMinute
}

function localMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const hour = read("hour")
  return (hour === 24 ? 0 : hour) * 60 + read("minute")
}

function overlap(start: number, end: number, windowStart: number, windowEnd: number): number {
  return Math.max(0, Math.min(end, windowEnd) - Math.max(start, windowStart))
}

function otCandidate(at: Date, minutes: number): OtCandidate | null {
  if (minutes <= COMPANY_WORK_RULE.otThresholdMinutes) return null
  return { at, minutes, needsConfirm: true }
}

/** Man hour ตามช่วงงานบริษัท และรายการ OT ที่ต้องยืนยันจากสแกนแรก/สแกนสุดท้าย */
export function summarizeManHour(firstIn: Date, lastOut: Date | null, timeZone: string): ManHourResult {
  const inMinute = localMinutes(firstIn, timeZone)
  const before = Math.max(0, COMPANY_WORK_RULE.startMinute - inMinute)
  const lateMinutes = Math.max(0, inMinute - COMPANY_WORK_RULE.startMinute)
  if (!lastOut) {
    return { manMinutes: 0, lateMinutes, otBefore: otCandidate(firstIn, before), otAfter: null }
  }

  const outMinute = localMinutes(lastOut, timeZone)
  const after = Math.max(0, outMinute - COMPANY_WORK_RULE.endMinute)
  if (outMinute <= inMinute) {
    return { manMinutes: 0, lateMinutes, otBefore: otCandidate(firstIn, before), otAfter: otCandidate(lastOut, after) }
  }

  const inside = overlap(inMinute, outMinute, COMPANY_WORK_RULE.startMinute, COMPANY_WORK_RULE.endMinute)
  const breakOverlap = overlap(inMinute, outMinute, COMPANY_WORK_RULE.breakStartMinute, COMPANY_WORK_RULE.breakEndMinute)
  const manMinutes = Math.min(8 * 60, Math.max(0, inside - breakOverlap))

  return {
    manMinutes,
    lateMinutes,
    otBefore: otCandidate(firstIn, before),
    otAfter: otCandidate(lastOut, after),
  }
}

/** ใช้ผลยืนยันเมื่อเวลาสแกนยังตรงกับรายการเดิม ไม่งั้นกลับไปรอยืนยัน */
export function presentOt(candidate: OtCandidate | null, decision: StoredOtDecision | null): OtRowView | null {
  if (!candidate) return null
  if (!decision || decision.punchAt.getTime() !== candidate.at.getTime()) {
    return { at: candidate.at, minutes: candidate.minutes, status: "PENDING" }
  }
  return {
    at: candidate.at,
    minutes: decision.decision === "OT" ? decision.otMinutes : candidate.minutes,
    status: decision.decision,
  }
}
