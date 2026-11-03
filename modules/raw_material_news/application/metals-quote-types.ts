export type MetalQuote = {
  name: string
  month: string | null
  last: number
  change: number
  changePct: number
  time: string
}

export type BotUsdRateSnapshot = {
  rate: number | null
  period: string | null
  sourceUrl: string
  error: string | null
}

export type MetalsQuoteSnapshot = {
  fetchedAt: string
  sourceUrl: string
  quotes: MetalQuote[]
  error: string | null
  usdThb: BotUsdRateSnapshot
}
