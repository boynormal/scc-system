import { describe, expect, it } from "vitest"
import { parseInvestingMetalsTable } from "@/modules/raw_material_news/infra/investing-metals-client"

const html = `
  <div class="group table" data-test="ws-markets-item">
    <span dir="ltr">SET</span>
  </div>
  <div data-test="dynamic-table">
    <table>
      <thead><tr><th>ชื่อ</th><th>เดือน</th><th>ล่าสุด</th></tr></thead>
      <tbody>
        <tr>
          <td><input type="checkbox" value="Lead"/></td>
          <td><a title="Lead - (CFD)"><span dir="ltr">Lead</span></a><span>derived</span></td>
          <td></td>
          <td style="--cell-positions:last"><div>1,894.05</div></td>
          <td>1,899.50</td>
          <td>1,893.60</td>
          <td style="--cell-positions:chg">-10.85</td>
          <td style="--cell-positions:chg-pct">-0.57%</td>
          <td><time dateTime="08:27:27">08:27:27</time></td>
        </tr>
        <tr>
          <td><input type="checkbox" value="ทองแดง"/></td>
          <td><a title="ทองแดง"><span dir="ltr">ทองแดง</span></a></td>
          <td>ธ.ค.26</td>
          <td style="--cell-positions:last">6.539</td>
          <td>6.5533</td>
          <td>6.5345</td>
          <td style="--cell-positions:chg">+0.120</td>
          <td style="--cell-positions:chg-pct">+0.24%</td>
          <td><time>08:01:04</time></td>
        </tr>
        <tr>
          <td><input type="checkbox" value="ทองแดง"/></td>
          <td><a title="ทองแดง"><span dir="ltr">ทองแดง</span></a></td>
          <td></td>
          <td style="--cell-positions:last">14,374.33</td>
          <td>14,376.33</td>
          <td>14,190.30</td>
          <td style="--cell-positions:chg">+224.73</td>
          <td style="--cell-positions:chg-pct">+1.59%</td>
          <td><time>00:26:57</time></td>
        </tr>
        <tr>
          <td><a><span dir="ltr">ดีบุก</span></a></td>
          <td></td>
          <td style="--cell-positions:last">49,706.00</td>
          <td>49,706.00</td>
          <td>49,706.00</td>
          <td style="--cell-positions:chg">-1,079.00</td>
          <td style="--cell-positions:chg-pct">-2.12%</td>
          <td><time dateTime="29/10">29/10</time></td>
        </tr>
      </tbody>
    </table>
  </div>
  <div data-test="dynamic-table">
    <table>
      <tbody>
        <tr>
          <td><a><span dir="ltr">ยูเรเนียม</span></a></td>
          <td>ธ.ค.26</td>
          <td style="--cell-positions:last">92.55</td>
          <td>92.55</td>
          <td>92.55</td>
          <td style="--cell-positions:chg">+0.30</td>
          <td style="--cell-positions:chg-pct">+0.33%</td>
          <td><time>30/10</time></td>
        </tr>
      </tbody>
    </table>
  </div>
`

describe("parseInvestingMetalsTable", () => {
  it("reads the first metals table and skips later sections", () => {
    const quotes = parseInvestingMetalsTable(html)
    expect(quotes.map((row) => row.name)).toEqual(["Lead", "ทองแดง", "ทองแดง", "ดีบุก"])
    expect(quotes[0]).toEqual({
      name: "Lead",
      month: null,
      last: 1894.05,
      change: -10.85,
      changePct: -0.57,
      time: "08:27:27",
    })
    expect(quotes[1]).toMatchObject({ month: "ธ.ค.26", last: 6.539, change: 0.12, changePct: 0.24, time: "08:01:04" })
    expect(quotes[2]).toMatchObject({ name: "ทองแดง", month: null, last: 14374.33, change: 224.73 })
    expect(quotes[3]).toMatchObject({ name: "ดีบุก", month: null, change: -1079, time: "29/10" })
  })

  it("returns no rows when the metals table is missing", () => {
    expect(parseInvestingMetalsTable("<div>ไม่มีตาราง</div>")).toEqual([])
  })
})
