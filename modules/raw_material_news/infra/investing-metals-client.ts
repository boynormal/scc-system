import { execFile } from "node:child_process"

import type { MetalQuote } from "@/modules/raw_material_news/application/metals-quote-types"
import {
  INVESTING_METALS_REVALIDATE_SECONDS,
  INVESTING_METALS_URL,
} from "@/modules/raw_material_news/application/paper-market-constants"
import { FETCH_TIMEOUT_MS, stripHtml } from "@/modules/raw_material_news/infra/fetch-utils"

const TABLE_MARKER = 'data-test="dynamic-table"'

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/%/g, "").replace(/\+/g, "").trim()
  if (!cleaned || cleaned === "-" || cleaned === "—") return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

function cellPosition(attrs: string): string {
  return (attrs.match(/--cell-positions:\s*([a-z-]+)/i)?.[1] ?? "").toLowerCase()
}

function parseRow(rowHtml: string): MetalQuote | null {
  const name = rowHtml.match(/<span[^>]*\bdir="ltr"[^>]*>([^<]+)<\/span>/i)?.[1]?.trim() ?? ""
  if (!name || name.toLowerCase() === "derived") return null

  const cells = [...rowHtml.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)]
  if (cells.length < 5) return null

  let month: string | null = null
  let last: number | null = null
  let change: number | null = null
  let changePct: number | null = null
  let time = ""
  let seenName = false

  for (const cell of cells) {
    const attrs = cell[1] ?? ""
    const inner = cell[2] ?? ""
    const position = cellPosition(`${attrs} ${inner}`)

    if (position === "last") {
      last = parseNumber(stripHtml(inner))
      continue
    }
    if (position === "chg-pct") {
      changePct = parseNumber(stripHtml(inner))
      continue
    }
    if (position === "chg") {
      change = parseNumber(stripHtml(inner))
      continue
    }

    const timeMatch = inner.match(/<time\b[^>]*>([^<]*)<\/time>/i)
    if (timeMatch) {
      time = (timeMatch[1] ?? "").trim()
      continue
    }

    if (/<a\b/i.test(inner) && /dir="ltr"/i.test(inner)) {
      seenName = true
      continue
    }

    if (seenName && last == null && month == null && !/<input\b/i.test(inner)) {
      const monthText = stripHtml(inner).replace(/\bderived\b/gi, "").trim()
      month = monthText || null
    }
  }

  if (last == null || change == null || changePct == null) return null
  return { name, month, last, change, changePct, time }
}

/** First metals table only. Later tables (US futures, EUREX) are ignored. */
export function parseInvestingMetalsTable(html: string): MetalQuote[] {
  const marker = html.indexOf(TABLE_MARKER)
  if (marker < 0) return []
  const tableStart = html.indexOf("<table", marker)
  if (tableStart < 0) return []
  const tableEnd = html.indexOf("</table>", tableStart)
  if (tableEnd < 0) return []

  const table = html.slice(tableStart, tableEnd)
  const bodyStart = table.search(/<tbody\b/i)
  const body = bodyStart >= 0 ? table.slice(bodyStart) : table
  const quotes: MetalQuote[] = []

  for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const quote = parseRow(row[1] ?? "")
    if (quote) quotes.push(quote)
  }

  return quotes
}

const CURL_MAX_BUFFER = 4 * 1024 * 1024

let cachedQuotes: { expiresAt: number; quotes: MetalQuote[] } | null = null
let pendingLoad: Promise<MetalQuote[]> | null = null

function curlBin(): string {
  return process.platform === "win32" ? "curl.exe" : "curl"
}

function fetchMetalsHtml(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      curlBin(),
      [
        "-fsSL",
        "--max-time",
        "30",
        "-A",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "-H",
        "Accept: text/html,application/xhtml+xml",
        "-H",
        "Accept-Language: th-TH,th;q=0.9",
        INVESTING_METALS_URL,
      ],
      {
        encoding: "utf8",
        maxBuffer: CURL_MAX_BUFFER,
        timeout: FETCH_TIMEOUT_MS,
        windowsHide: true,
      },
      (err, stdout) => {
        if (err || !stdout) {
          console.error("[raw-material-news:metals] curl", err)
          reject(new Error("แหล่งข้อมูลตอบกลับไม่สำเร็จ"))
          return
        }
        resolve(stdout)
      }
    )
  })
}

async function loadQuotes(): Promise<MetalQuote[]> {
  const html = await fetchMetalsHtml()
  const quotes = parseInvestingMetalsTable(html)
  if (quotes.length === 0) throw new Error("ไม่พบตารางราคาโลหะ")
  cachedQuotes = {
    expiresAt: Date.now() + INVESTING_METALS_REVALIDATE_SECONDS * 1000,
    quotes,
  }
  return quotes
}

/** Node fetch is rejected with 403. curl receives the table. One shared copy per process for 60s. */
export function fetchInvestingMetals(): Promise<MetalQuote[]> {
  if (cachedQuotes && cachedQuotes.expiresAt > Date.now()) {
    return Promise.resolve(cachedQuotes.quotes)
  }
  if (!pendingLoad) {
    pendingLoad = loadQuotes().finally(() => {
      pendingLoad = null
    })
  }
  return pendingLoad
}
