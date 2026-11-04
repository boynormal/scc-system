import type { BotUsdRateSnapshot, MetalsQuoteSnapshot } from "@/modules/raw_material_news/application/metals-quote-types"
import { BOT_EXCHANGE_RATE_PAGE_URL, FX678_LME_URL } from "@/modules/raw_material_news/application/paper-market-constants"
import { fetchBotUsdRate } from "@/modules/raw_material_news/infra/bot-ref-rate-client"
import { fetchFx678Metals } from "@/modules/raw_material_news/infra/fx678-metals-client"

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message
  return fallback
}

function unavailableRate(): BotUsdRateSnapshot {
  return {
    rate: null,
    period: null,
    sourceUrl: BOT_EXCHANGE_RATE_PAGE_URL,
    error: "ดึงอัตราแลกเปลี่ยนไม่สำเร็จ",
  }
}

export async function getMetalsQuoteSnapshot(): Promise<MetalsQuoteSnapshot> {
  const fetchedAt = new Date().toISOString()
  const [quotesResult, usdResult] = await Promise.allSettled([fetchFx678Metals(), fetchBotUsdRate()])
  const usdThb = usdResult.status === "fulfilled" ? usdResult.value : unavailableRate()

  if (quotesResult.status === "rejected") {
    return {
      fetchedAt,
      sourceUrl: FX678_LME_URL,
      quotes: [],
      error: errorMessage(quotesResult.reason, "ดึงราคาโลหะไม่สำเร็จ"),
      usdThb,
    }
  }

  if (quotesResult.value.length === 0) {
    return {
      fetchedAt,
      sourceUrl: FX678_LME_URL,
      quotes: [],
      error: "ไม่พบตารางราคาโลหะ",
      usdThb,
    }
  }

  return {
    fetchedAt,
    sourceUrl: FX678_LME_URL,
    quotes: quotesResult.value,
    error: null,
    usdThb,
  }
}
