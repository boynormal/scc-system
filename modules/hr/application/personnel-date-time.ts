import { zonedDateTime } from "./attendance-daily-summary"

export const PERSONNEL_TIME_ZONE = "Asia/Bangkok"

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/

/** รับ YYYY-MM-DD หรือ YYYY-MM-DDTHH:mm เป็นเวลาไทย */
export function parsePersonnelDateTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = DATE_TIME.exec(value.trim())
  if (!match) return null
  return zonedDateTime(match[1]!, match[2] ?? "00:00", PERSONNEL_TIME_ZONE)
}

export function isPersonnelDateTime(value: string | null | undefined): boolean {
  return value == null || value === "" || DATE_TIME.test(value.trim())
}

/** ค่าสำหรับ input datetime-local */
export function personnelDateTimeInput(value: Date | null): string | null {
  if (!value) return null
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERSONNEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ""
  const hour = part("hour") === "24" ? "00" : part("hour")
  return `${part("year")}-${part("month")}-${part("day")}T${hour}:${part("minute")}`
}

/** วันที่ตามเวลาไทย สำหรับตัวชี้วัดที่นับเป็นรายวัน */
export function personnelDateKey(value: Date | null): string | null {
  if (!value) return null
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PERSONNEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value)
}

export function formatPersonnelDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—"
  if (typeof value === "string") {
    const match = DATE_TIME.exec(value.trim())
    if (!match) return value
    return `${match[1]} ${match[2] ?? "00:00"}`
  }
  return personnelDateTimeInput(value)?.replace("T", " ") ?? "—"
}

export function personnelDateTimeReached(value: string | null | undefined, now = new Date()): boolean {
  const at = parsePersonnelDateTime(value)
  return at != null && at.getTime() <= now.getTime()
}
