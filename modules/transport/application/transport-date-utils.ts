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
  const start = new Date(`${dateStr}T00:00:00+07:00`)
  const end = new Date(`${dateStr}T23:59:59.999+07:00`)
  return { start, end }
}

export function isScheduledTodayBangkok(scheduledDate: Date | null | undefined): boolean {
  if (!scheduledDate) return true
  const { start, end } = getBangkokTodayRange()
  const t = scheduledDate.getTime()
  return t >= start.getTime() && t <= end.getTime()
}
