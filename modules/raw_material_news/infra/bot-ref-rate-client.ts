import { inflateRawSync } from "node:zlib"

import type { BotUsdRateSnapshot } from "@/modules/raw_material_news/application/metals-quote-types"
import {
  BOT_EXCHANGE_RATE_PAGE_URL,
  BOT_FX_CSV_ZIP_URL,
  BOT_REF_RATE_REVALIDATE_SECONDS,
} from "@/modules/raw_material_news/application/paper-market-constants"
import { fetchUpstream } from "@/modules/raw_material_news/infra/fetch-utils"

export type DailyRefRate = {
  period: string
  rate: number
}

const PERIOD_RE = /^\d{4}-\d{2}-\d{2}$/
const CSV1_NAME_RE = /^ER_CSV1_(\d{4}-\d{2}-\d{2})\.csv$/i
const USD_TRANSFER_RE = /\|USD\|[0-9]+(?:\.[0-9]+)?\|([0-9]+(?:\.[0-9]+)?)/
const ZIP_LOCAL_HEADER = 0x04034b50

/** USD average transfer buying rate: country|USD|sight|transfer|selling. */
export function parseUsdBuyingTransfer(text: string, period: string): DailyRefRate | null {
  if (!PERIOD_RE.test(period)) return null
  const match = text.match(USD_TRANSFER_RE)
  if (!match) return null
  const rate = Number(match[1])
  if (!Number.isFinite(rate) || rate <= 0) return null
  return { period, rate }
}

function decodeCsv(raw: Buffer): string {
  const thai = new TextDecoder("windows-874").decode(raw)
  if (USD_TRANSFER_RE.test(thai)) return thai
  return new TextDecoder("utf-8").decode(raw)
}

/** First ER_CSV1 entry in the public daily zip. The file is Windows-874. */
export function weightedRateFromZip(zip: Buffer): DailyRefRate | null {
  let offset = 0
  while (offset + 30 <= zip.length) {
    if (zip.readUInt32LE(offset) !== ZIP_LOCAL_HEADER) break
    const method = zip.readUInt16LE(offset + 8)
    const compressedSize = zip.readUInt32LE(offset + 18)
    const nameLength = zip.readUInt16LE(offset + 26)
    const extraLength = zip.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const dataEnd = dataStart + compressedSize
    if (dataEnd > zip.length) return null

    const name = zip.slice(nameStart, nameStart + nameLength).toString("utf8")
    const compressed = zip.slice(dataStart, dataEnd)
    offset = dataEnd

    const period = name.match(CSV1_NAME_RE)?.[1]
    if (!period) continue
    const raw = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null
    if (!raw) return null
    return parseUsdBuyingTransfer(decodeCsv(raw), period)
  }
  return null
}

function emptyRate(error: string): BotUsdRateSnapshot {
  return {
    rate: null,
    period: null,
    sourceUrl: BOT_EXCHANGE_RATE_PAGE_URL,
    error,
  }
}

let cachedRate: { expiresAt: number; value: BotUsdRateSnapshot } | null = null
let pendingRate: Promise<BotUsdRateSnapshot> | null = null

async function loadBotUsdRate(): Promise<BotUsdRateSnapshot> {
  try {
    const res = await fetchUpstream(BOT_FX_CSV_ZIP_URL, {
      revalidate: BOT_REF_RATE_REVALIDATE_SECONDS,
      accept: "application/zip,application/octet-stream",
    })
    if (!res.ok) return emptyRate("ดึงอัตราแลกเปลี่ยนไม่สำเร็จ")
    const latest = weightedRateFromZip(Buffer.from(await res.arrayBuffer()))
    if (!latest) return emptyRate("ไม่พบอัตราแลกเปลี่ยน")
    const value: BotUsdRateSnapshot = {
      rate: latest.rate,
      period: latest.period,
      sourceUrl: BOT_EXCHANGE_RATE_PAGE_URL,
      error: null,
    }
    cachedRate = { expiresAt: Date.now() + BOT_REF_RATE_REVALIDATE_SECONDS * 1000, value }
    return value
  } catch (err) {
    console.error("[raw-material-news:bot-ref-rate]", err instanceof Error ? err.message : "fetch failed")
    return emptyRate("ดึงอัตราแลกเปลี่ยนไม่สำเร็จ")
  }
}

/** One shared copy per process for 6 hours. A failed call is not cached. */
export function fetchBotUsdRate(): Promise<BotUsdRateSnapshot> {
  if (cachedRate && cachedRate.expiresAt > Date.now()) return Promise.resolve(cachedRate.value)
  if (!pendingRate) {
    pendingRate = loadBotUsdRate().finally(() => {
      pendingRate = null
    })
  }
  return pendingRate
}
