export type FxSeriesStats = {
  latest: number
  previous: number | null
  changePct: number | null
  min: number
  max: number
  avg: number
}

export type FxHistoryPoint = {
  date: string
  usdThb: number
  cnyThb: number
}

export type PaperFxSnapshot = {
  usdThb: number
  cnyThb: number
  history: FxHistoryPoint[]
  stats: { usd: FxSeriesStats; cny: FxSeriesStats }
  sourceLabel: string
}

export type SunsirsHistoryPoint = {
  date: string
  price: number
  index: number
}

export type PaperSunsirsSnapshot = {
  commodity: string
  unit: string
  latest: number
  previous: number | null
  changePct: number | null
  index: number
  history: SunsirsHistoryPoint[]
  sourceUrl: string
}

export type FreightHistoryPoint = {
  date: string
  value: number
}

export type PaperFreightSnapshot = {
  lane: string
  currentUsd: number
  volatilityPct: number | null
  changePct: number | null
  history: FreightHistoryPoint[]
  sourceUrl: string
}

export type PaperMarketErrors = {
  fx?: string
  sunsirs?: string
  freight?: string
}

export type PaperMarketSnapshot = {
  fetchedAt: string
  fx: PaperFxSnapshot | null
  sunsirs: PaperSunsirsSnapshot | null
  freight: PaperFreightSnapshot | null
  errors: PaperMarketErrors
}
