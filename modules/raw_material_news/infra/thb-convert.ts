export type CnyThbPoint = {
  date: string
  cnyThb: number
}

export type UsdThbPoint = {
  date: string
  usdThb: number
}

export function toThbPerTon(rmbPerTon: number, cnyThb: number): number {
  return rmbPerTon * cnyThb
}

export function toThbPerKg(thbPerTon: number): number {
  return thbPerTon / 1000
}

export function rmbTonToThb(
  rmbPerTon: number,
  cnyThb: number | null | undefined
): { thbPerTon: number; thbPerKg: number } | null {
  if (cnyThb == null || !Number.isFinite(cnyThb) || !Number.isFinite(rmbPerTon)) return null
  const thbPerTon = toThbPerTon(rmbPerTon, cnyThb)
  return { thbPerTon, thbPerKg: toThbPerKg(thbPerTon) }
}

/** Prefer the CNY/THB rate on `date`; otherwise the latest fallback. */
export function cnyThbForDate(
  date: string,
  history: CnyThbPoint[],
  fallback: number | null | undefined
): number | null {
  const hit = history.find((p) => p.date === date)
  if (hit && Number.isFinite(hit.cnyThb)) return hit.cnyThb
  if (fallback != null && Number.isFinite(fallback)) return fallback
  return null
}

export function usdToThb(usd: number, usdThb: number | null | undefined): number | null {
  if (usdThb == null || !Number.isFinite(usdThb) || !Number.isFinite(usd)) return null
  return usd * usdThb
}

/** Prefer the USD/THB rate on `date`; otherwise the latest fallback. */
export function usdThbForDate(
  date: string,
  history: UsdThbPoint[],
  fallback: number | null | undefined
): number | null {
  const hit = history.find((p) => p.date === date)
  if (hit && Number.isFinite(hit.usdThb)) return hit.usdThb
  if (fallback != null && Number.isFinite(fallback)) return fallback
  return null
}
