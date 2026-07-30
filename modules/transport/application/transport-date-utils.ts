/** Bangkok timezone helpers for transport scheduling / GPS availability. */

export function getBangkokTodayRange(): { start: Date; end: Date } {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const dateStr = fmt.format(now)
  return getBangkokDateRange(dateStr, dateStr)
}

/** Inclusive calendar-day range in Asia/Bangkok (`YYYY-MM-DD`). */
export function getBangkokDateRange(fromYmd: string, toYmd: string): { start: Date; end: Date } {
  const start = new Date(`${fromYmd}T00:00:00+07:00`)
  const end = new Date(`${toYmd}T23:59:59.999+07:00`)
  return { start, end }
}

/** Format a Date as `YYYY-MM-DD` in Asia/Bangkok. */
export function formatBangkokYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** Last N calendar days ending today (Bangkok), inclusive. */
export function getBangkokLastNDaysRange(days: number): { from: string; to: string } {
  const to = formatBangkokYmd()
  const n = Math.max(1, days)
  const anchor = new Date(`${to}T12:00:00+07:00`)
  const fromDate = new Date(anchor.getTime() - (n - 1) * 24 * 60 * 60 * 1000)
  const from = formatBangkokYmd(fromDate)
  return { from, to }
}

export function isScheduledTodayBangkok(scheduledDate: Date | null | undefined): boolean {
  if (!scheduledDate) return true
  const { start, end } = getBangkokTodayRange()
  const t = scheduledDate.getTime()
  return t >= start.getTime() && t <= end.getTime()
}
