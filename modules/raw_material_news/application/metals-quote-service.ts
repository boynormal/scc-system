import type { BotUsdRateSnapshot, MetalsQuoteSnapshot } from "@/modules/raw_material_news/application/metals-quote-types"
import { BOT_EXCHANGE_RATE_PAGE_URL, INVESTING_METALS_URL } from "@/modules/raw_material_news/application/paper-market-constants"
import { fetchBotUsdRate } from "@/modules/raw_material_news/infra/bot-ref-rate-client"
import { fetchInvestingMetals } from "@/modules/raw_material_news/infra/investing-metals-client"

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
  const [quotesResult, usdResult] = await Promise.allSettled([fetchInvestingMetals(), fetchBotUsdRate()])
  const usdThb = usdResult.status === "fulfilled" ? usdResult.value : unavailableRate()

  if (quotesResult.status === "rejected") {
    console.error("[raw-material-news:metals]", quotesResult.reason)
    return {
      fetchedAt,
      sourceUrl: INVESTING_METALS_URL,
      quotes: [],
      error: errorMessage(quotesResult.reason, "ดึงราคาโลหะไม่สำเร็จ"),
      usdThb,
    }
  }

  if (quotesResult.value.length === 0) {
    return {
      fetchedAt,
      sourceUrl: INVESTING_METALS_URL,
      quotes: [],
      error: "ไม่พบตารางราคาโลหะ",
      usdThb,
    }
  }

  return {
    fetchedAt,
    sourceUrl: INVESTING_METALS_URL,
    quotes: quotesResult.value,
    error: null,
    usdThb,
  }
}
