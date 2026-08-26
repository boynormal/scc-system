import type {
  FreightHistoryPoint,
  PaperFreightSnapshot,
} from "@/modules/raw_material_news/application/paper-market-types"
import {
  FREIGHTOS_FBX02_URL,
  FREIGHTOS_FBX02_WP_JSON_URL,
} from "@/modules/raw_material_news/application/paper-market-constants"
import { fetchUpstreamJson, stripHtml } from "@/modules/raw_material_news/infra/fetch-utils"

const FREIGHT_REVALIDATE = 21600

type WpPage = {
  content?: { rendered?: string }
}

type ChartPointRaw = {
  ticker?: string
  indexDate?: string
  value?: unknown
}

type TickerRaw = {
  label?: string
  value?: string
  change?: string
}

export type ParsedFbx02 = {
  currentUsd: number
  volatilityPct: number | null
  changePct: number | null
  history: FreightHistoryPoint[]
}

function extractJsArray(html: string, variableName: string): unknown[] | null {
  const pattern = new RegExp(`${variableName}\\s*\\[[^\\]]+\\]\\s*=\\s*(\\[[\\s\\S]*?\\]);`, "i")
  const match = html.match(pattern)
  if (!match?.[1]) return null
  try {
    const parsed: unknown = JSON.parse(match[1])
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function parseHistory(html: string): FreightHistoryPoint[] {
  const raw = extractJsArray(html, "frProductIntroChartData")
  if (!raw) return []
  const points: FreightHistoryPoint[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as ChartPointRaw
    if (row.ticker && String(row.ticker).toUpperCase() !== "FBX02") continue
    const date = typeof row.indexDate === "string" ? row.indexDate.trim() : ""
    const value = Number(row.value)
    if (!date || !Number.isFinite(value)) continue
    points.push({ date, value })
  }
  points.sort((a, b) => a.date.localeCompare(b.date))
  return points
}

function parseTickerChangePct(html: string): number | null {
  const raw = extractJsArray(html, "frProductIntroTickerData")
  if (!raw) return null
  const fbx02 = raw.find((item): item is TickerRaw => {
    if (!item || typeof item !== "object") return false
    return String((item as TickerRaw).label ?? "").toUpperCase() === "FBX02"
  })
  if (!fbx02?.change) return null
  const match = fbx02.change.match(/([+-]?[0-9]+(?:\.[0-9]+)?)\s*%/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function parseCurrentFbxFromText(text: string): number | null {
  const currentMatch = text.match(/Current FBX[^0-9$]{0,120}\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i)
  if (!currentMatch) return null
  const currentUsd = Number(currentMatch[1]!.replace(/,/g, ""))
  return Number.isFinite(currentUsd) ? currentUsd : null
}

function parseVolatilityFromText(text: string): number | null {
  const volMatch = text.match(/Volatility[^0-9]{0,120}([0-9]+(?:\.[0-9]+)?)\s*%/i)
  if (!volMatch) return null
  const volatilityPct = Number(volMatch[1])
  return Number.isFinite(volatilityPct) ? volatilityPct : null
}

export function parseFreightosFbx02(html: string): ParsedFbx02 {
  const text = stripHtml(html)
  const history = parseHistory(html)
  const currentUsd = parseCurrentFbxFromText(text) ?? history.at(-1)?.value
  if (currentUsd == null) throw new Error("ไม่พบค่า Current FBX")

  return {
    currentUsd,
    volatilityPct: parseVolatilityFromText(text),
    changePct: parseTickerChangePct(html),
    history,
  }
}

export async function fetchFreightosFbx02(): Promise<PaperFreightSnapshot> {
  const pages = await fetchUpstreamJson<WpPage[]>(FREIGHTOS_FBX02_WP_JSON_URL, FREIGHT_REVALIDATE)
  const html = pages[0]?.content?.rendered?.trim()
  if (!html) throw new Error("ไม่พบเนื้อหา Freightos จาก WordPress REST")
  const parsed = parseFreightosFbx02(html)
  return {
    lane: "FBX02 North America West Coast to China",
    currentUsd: parsed.currentUsd,
    volatilityPct: parsed.volatilityPct,
    changePct: parsed.changePct,
    history: parsed.history,
    sourceUrl: FREIGHTOS_FBX02_URL,
  }
}
