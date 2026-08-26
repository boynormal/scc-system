import type { FxSeriesStats } from "@/modules/raw_material_news/application/paper-market-types"

export function computeSeriesStats(values: number[]): FxSeriesStats | null {
  if (values.length === 0) return null
  const latest = values[values.length - 1]!
  const previous = values.length > 1 ? values[values.length - 2]! : null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length
  const changePct =
    previous != null && previous !== 0 ? ((latest - previous) / previous) * 100 : null
  return { latest, previous, changePct, min, max, avg }
}
