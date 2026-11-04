function pad(value: number): string {
  return String(value).padStart(2, "0")
}

export function currentFinanceMonth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).slice(0, 7)
}

export function shiftFinanceMonth(month: string, delta: number): string {
  const [year, monthNum] = month.split("-").map(Number)
  if (!year || !monthNum) return month
  const next = new Date(Date.UTC(year, monthNum - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`
}

/** First and last calendar day of `YYYY-MM`. */
export function financeMonthRange(month: string): { dateFrom: string; dateTo: string } {
  const [year, monthNum] = month.split("-").map(Number)
  const last = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  const mm = pad(monthNum)
  return { dateFrom: `${year}-${mm}-01`, dateTo: `${year}-${mm}-${pad(last)}` }
}
