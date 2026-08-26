import type {
  PaperSunsirsSnapshot,
  SunsirsHistoryPoint,
} from "@/modules/raw_material_news/application/paper-market-types"
import { SUNSIRS_WASTEPAPER_URL } from "@/modules/raw_material_news/application/paper-market-constants"
import { fetchUpstreamText, stripHtml } from "@/modules/raw_material_news/infra/fetch-utils"

const SUNSIRS_REVALIDATE = 21600

export type SunsirsPriceRow = {
  commodity: string
  price: number
  date: string
}

function cellText(raw: string): string {
  return stripHtml(raw)
}

export function parseSunsirsWastepaperTable(html: string): SunsirsPriceRow[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  const points: SunsirsPriceRow[] = []

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => cellText(m[1] ?? ""))
    if (cells.length < 4) continue
    const commodity = cells[0] ?? ""
    if (!/wastepaper/i.test(commodity)) continue
    const price = Number((cells[2] ?? "").replace(/,/g, ""))
    const dateMatch = (cells[3] ?? "").match(/(\d{4}-\d{2}-\d{2})/)
    if (!Number.isFinite(price) || !dateMatch) continue
    points.push({ commodity: commodity || "Wastepaper", price, date: dateMatch[1]! })
  }

  const byDate = new Map<string, SunsirsPriceRow>()
  for (const p of points) byDate.set(p.date, p)
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function toSunsirsSnapshot(rows: SunsirsPriceRow[]): PaperSunsirsSnapshot {
  if (rows.length === 0) throw new Error("ไม่พบตารางราคา Wastepaper")
  const base = rows[0]!.price
  if (base === 0) throw new Error("ราคาฐานเป็นศูนย์")

  const history: SunsirsHistoryPoint[] = rows.map((row) => ({
    date: row.date,
    price: row.price,
    index: (row.price / base) * 100,
  }))

  const latestRow = rows[rows.length - 1]!
  const previousRow = rows.length > 1 ? rows[rows.length - 2]! : null
  const changePct =
    previousRow && previousRow.price !== 0
      ? ((latestRow.price - previousRow.price) / previousRow.price) * 100
      : null

  return {
    commodity: latestRow.commodity,
    unit: "RMB/ton",
    latest: latestRow.price,
    previous: previousRow?.price ?? null,
    changePct,
    index: (latestRow.price / base) * 100,
    history,
    sourceUrl: SUNSIRS_WASTEPAPER_URL,
  }
}

export async function fetchSunsirsWastepaper(): Promise<PaperSunsirsSnapshot> {
  const html = await fetchUpstreamText(SUNSIRS_WASTEPAPER_URL, SUNSIRS_REVALIDATE)
  return toSunsirsSnapshot(parseSunsirsWastepaperTable(html))
}
