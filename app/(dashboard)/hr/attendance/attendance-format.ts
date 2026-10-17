export function todayInZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}

export function formatTime(iso: string | null, timeZone: string, locale: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString(locale === "th" ? "th-TH" : "en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function formatDateTime(iso: string | null, timeZone: string, locale: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(locale === "th" ? "th-TH" : "en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}:${String(m).padStart(2, "0")}`
}
