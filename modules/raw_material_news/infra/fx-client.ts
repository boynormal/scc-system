import type { FxHistoryPoint, PaperFxSnapshot } from "@/modules/raw_material_news/application/paper-market-types"
import { computeSeriesStats } from "@/modules/raw_material_news/infra/fx-stats"
import { fetchUpstreamJson } from "@/modules/raw_material_news/infra/fetch-utils"

const FX_REVALIDATE = 3600
const HISTORY_DAYS = 30

type OpenErLatest = {
  result?: string
  rates?: Record<string, number>
}

type CurrencyApiFile = {
  usd?: Record<string, number>
}

function isoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function lastNUtcDates(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    out.push(isoDateUtc(d))
  }
  return out
}

function cnyThbFromUsdRates(usdThb: number, usdCny: number): number | null {
  if (!Number.isFinite(usdThb) || !Number.isFinite(usdCny) || usdCny === 0) return null
  return usdThb / usdCny
}

async function fetchLatestUsdRates(): Promise<{ usdThb: number; cnyThb: number }> {
  const json = await fetchUpstreamJson<OpenErLatest>(
    "https://open.er-api.com/v6/latest/USD",
    FX_REVALIDATE
  )
  const usdThb = json.rates?.THB
  const usdCny = json.rates?.CNY
  if (!Number.isFinite(usdThb) || !Number.isFinite(usdCny)) {
    throw new Error("ไม่พบอัตรา USD/THB หรือ USD/CNY")
  }
  const cnyThb = cnyThbFromUsdRates(usdThb!, usdCny!)
  if (cnyThb == null) throw new Error("คำนวณ RMB/THB ไม่ได้")
  return { usdThb: usdThb!, cnyThb }
}

async function fetchHistoryPoint(date: string): Promise<FxHistoryPoint | null> {
  const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.min.json`
  try {
    const json = await fetchUpstreamJson<CurrencyApiFile>(url, FX_REVALIDATE)
    const usdThb = json.usd?.thb
    const usdCny = json.usd?.cny
    if (!Number.isFinite(usdThb) || !Number.isFinite(usdCny)) return null
    const cnyThb = cnyThbFromUsdRates(usdThb!, usdCny!)
    if (cnyThb == null) return null
    return { date, usdThb: usdThb!, cnyThb }
  } catch {
    return null
  }
}

export async function fetchPaperFx(): Promise<PaperFxSnapshot> {
  const latest = await fetchLatestUsdRates()
  const dates = lastNUtcDates(HISTORY_DAYS)
  const settled = await Promise.all(dates.map((date) => fetchHistoryPoint(date)))
  const history = settled.filter((p): p is FxHistoryPoint => p != null)

  const today = isoDateUtc(new Date())
  const last = history[history.length - 1]
  if (!last || last.date !== today) {
    history.push({ date: today, usdThb: latest.usdThb, cnyThb: latest.cnyThb })
  } else {
    last.usdThb = latest.usdThb
    last.cnyThb = latest.cnyThb
  }

  const usdStats = computeSeriesStats(history.map((p) => p.usdThb))
  const cnyStats = computeSeriesStats(history.map((p) => p.cnyThb))
  if (!usdStats || !cnyStats) throw new Error("สถิติอัตราแลกเปลี่ยนไม่ครบ")

  return {
    usdThb: latest.usdThb,
    cnyThb: latest.cnyThb,
    history,
    stats: { usd: usdStats, cny: cnyStats },
    sourceLabel: "open.er-api.com",
  }
}
