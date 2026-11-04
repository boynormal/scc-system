import { execFile } from "node:child_process"

import type { MetalQuote } from "@/modules/raw_material_news/application/metals-quote-types"
import {
  FX678_LME_URL,
  FX678_METALS_REVALIDATE_SECONDS,
  FX678_PRECIOUS_URL,
} from "@/modules/raw_material_news/application/paper-market-constants"
import { FETCH_TIMEOUT_MS, stripHtml } from "@/modules/raw_material_news/infra/fetch-utils"

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

/** Display order. LME base metals first, then spot precious metals. */
const ROW_ORDER = ["LMCI", "LMAI", "LMZI", "LMPI", "LMNI", "LMSI", "XAU", "XAG", "XAP", "XPD"] as const

const ROW_NAMES: Record<(typeof ROW_ORDER)[number], string> = {
  LMCI: "ทองแดง",
  LMAI: "อะลูมิเนียม",
  LMZI: "สังกะสี",
  LMPI: "ตะกั่ว",
  LMNI: "นิกเกิล",
  LMSI: "ดีบุก",
  XAU: "ทองคำ",
  XAG: "เงิน",
  XAP: "ทองคำขาว",
  XPD: "พาลาเดียม",
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/%/g, "").replace(/\+/g, "").trim()
  if (!cleaned || cleaned === "-" || cleaned === "—") return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/** FX678 clocks are Beijing time (UTC+8). The card shows Thailand time (UTC+7). */
export function beijingClockToThailand(raw: string): string {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return raw.trim()
  const hour = Number(match[1])
  if (!Number.isInteger(hour) || hour > 23) return raw.trim()
  const thaiHour = (hour + 23) % 24
  return `${String(thaiHour).padStart(2, "0")}:${match[2]}`
}

function parseRow(rowHtml: string, id: string): MetalQuote | null {
  const name = ROW_NAMES[id as (typeof ROW_ORDER)[number]]
  if (!name) return null

  const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripHtml(cell[1] ?? ""))
  if (cells.length < 4) return null

  const last = parseNumber(cells[1] ?? "")
  const change = parseNumber(cells[2] ?? "")
  const changePct = parseNumber(cells[3] ?? "")
  if (last == null || change == null || changePct == null) return null

  const timeRaw = cells.length >= 8 ? (cells[7] ?? "") : (cells[cells.length - 1] ?? "")
  return {
    name,
    month: null,
    last,
    change,
    changePct,
    time: beijingClockToThailand(timeRaw),
  }
}

/** Reads known LME and precious-metal rows. Alloy, Hong Kong gold, and Taiwan gold are ignored. */
export function parseFx678MetalsTable(html: string): MetalQuote[] {
  const byId = new Map<string, MetalQuote>()

  for (const row of html.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    const id = (row[1] ?? "").match(/\bid="([A-Za-z0-9]+)"/i)?.[1]?.toUpperCase()
    if (!id) continue
    const quote = parseRow(row[2] ?? "", id)
    if (quote) byId.set(id, quote)
  }

  return ROW_ORDER.flatMap((id) => {
    const quote = byId.get(id)
    return quote ? [quote] : []
  })
}

const CURL_MAX_BUFFER = 4 * 1024 * 1024

let cachedQuotes: { expiresAt: number; quotes: MetalQuote[] } | null = null
let pendingLoad: Promise<MetalQuote[]> | null = null

function curlBin(): string {
  return process.platform === "win32" ? "curl.exe" : "curl"
}

/** Node fetch gives up after 10s. curl reaches FX678 within the 30s limit. */
function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      curlBin(),
      [
        "-fsSL",
        "--max-time",
        "30",
        "-A",
        BROWSER_USER_AGENT,
        "-H",
        "Accept: text/html,application/xhtml+xml",
        "-H",
        "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8",
        url,
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
  const [lme, precious] = await Promise.allSettled([fetchPage(FX678_LME_URL), fetchPage(FX678_PRECIOUS_URL)])
  const htmlParts: string[] = []

  if (lme.status === "fulfilled") htmlParts.push(lme.value)
  else console.error("[raw-material-news:metals] lme", lme.reason)

  if (precious.status === "fulfilled") htmlParts.push(precious.value)
  else console.error("[raw-material-news:metals] precious", precious.reason)

  const quotes = parseFx678MetalsTable(htmlParts.join("\n"))
  if (quotes.length === 0) throw new Error("ไม่พบตารางราคาโลหะ")

  cachedQuotes = {
    expiresAt: Date.now() + FX678_METALS_REVALIDATE_SECONDS * 1000,
    quotes,
  }
  return quotes
}

/** One shared copy per process for 60 seconds. A failed refresh does not replace the last good copy. */
export function fetchFx678Metals(): Promise<MetalQuote[]> {
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
