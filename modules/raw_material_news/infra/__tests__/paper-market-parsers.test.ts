import { describe, expect, it } from "vitest"
import { computeSeriesStats } from "@/modules/raw_material_news/infra/fx-stats"
import { parseFreightosFbx02 } from "@/modules/raw_material_news/infra/freightos-client"
import {
  parseSunsirsWastepaperTable,
  toSunsirsSnapshot,
} from "@/modules/raw_material_news/infra/sunsirs-client"

describe("computeSeriesStats", () => {
  it("computes min, max, avg, and percent change vs previous", () => {
    const stats = computeSeriesStats([32, 33, 34.1])
    expect(stats).not.toBeNull()
    expect(stats!.latest).toBe(34.1)
    expect(stats!.previous).toBe(33)
    expect(stats!.min).toBe(32)
    expect(stats!.max).toBe(34.1)
    expect(stats!.avg).toBeCloseTo(33.0333, 3)
    expect(stats!.changePct).toBeCloseTo(((34.1 - 33) / 33) * 100, 5)
  })

  it("returns null for an empty series", () => {
    expect(computeSeriesStats([])).toBeNull()
  })
})

describe("parseSunsirsWastepaperTable", () => {
  const html = `
    <table>
      <tr><th>Commodity</th><th>Sectors</th><th>Price</th><th>Date</th></tr>
      <tr><td>Wastepaper</td><td>Building materials</td><td>1978.00</td><td>2026-08-10</td></tr>
      <tr><td>Wastepaper</td><td>Building materials</td><td>1970.00</td><td>2026-08-06</td></tr>
      <tr><td>Corrugated paper</td><td>Building materials</td><td>3153.00</td><td>2026-08-10</td></tr>
    </table>
  `

  it("parses wastepaper rows and ignores other commodities", () => {
    const rows = parseSunsirsWastepaperTable(html)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ commodity: "Wastepaper", price: 1970, date: "2026-08-06" })
    expect(rows[1]).toEqual({ commodity: "Wastepaper", price: 1978, date: "2026-08-10" })
  })

  it("builds a 100-based index from the oldest price", () => {
    const snap = toSunsirsSnapshot(parseSunsirsWastepaperTable(html))
    expect(snap.latest).toBe(1978)
    expect(snap.previous).toBe(1970)
    expect(snap.index).toBeCloseTo((1978 / 1970) * 100, 5)
    expect(snap.history[0]?.index).toBe(100)
    expect(snap.changePct).toBeCloseTo(((1978 - 1970) / 1970) * 100, 5)
  })
})

describe("parseFreightosFbx02", () => {
  const wpHtml = `
    <p>Loading market data…</p>
    <script>
      window.frProductIntroTickerData = window.frProductIntroTickerData || {};
      window.frProductIntroTickerData['fr-product-intro-6a7d44ea33635'] = [{"label":"FBX","value":"$3,607","change":"-0.57%","positive":false},{"label":"FBX02","value":"$374","change":"-11.63%","positive":false}];
    </script>
    <script>
      window.frProductIntroChartData = window.frProductIntroChartData || {};
      window.frProductIntroChartData['fr-product-intro-6a7d44ea33635'] = [{"ticker":"FBX02","indexDate":"2026-05-15","value":476.4},{"ticker":"FBX02","indexDate":"2026-08-07","value":373.8}];
    </script>
    <p>Current FBX</p>
    <span>$373.80</span>
    <p>Volatility</p>
    <span>1.11 %</span>
  `

  it("extracts Current FBX, Volatility, weekly history, and ticker change from WP content", () => {
    expect(parseFreightosFbx02(wpHtml)).toEqual({
      currentUsd: 373.8,
      volatilityPct: 1.11,
      changePct: -11.63,
      history: [
        { date: "2026-05-15", value: 476.4 },
        { date: "2026-08-07", value: 373.8 },
      ],
    })
  })

  it("prefers Current FBX text over the rounded ticker value", () => {
    expect(parseFreightosFbx02(wpHtml).currentUsd).toBe(373.8)
  })

  it("falls back to the last chart point when Current FBX text is missing", () => {
    const html = `
      window.frProductIntroChartData['x'] = [{"ticker":"FBX02","indexDate":"2026-08-07","value":373.8}];
    `
    expect(parseFreightosFbx02(html).currentUsd).toBe(373.8)
    expect(parseFreightosFbx02(html).volatilityPct).toBeNull()
    expect(parseFreightosFbx02(html).changePct).toBeNull()
  })

  it("throws when Current FBX is missing", () => {
    expect(() => parseFreightosFbx02("<p>No index here</p>")).toThrow(/Current FBX/)
  })
})
