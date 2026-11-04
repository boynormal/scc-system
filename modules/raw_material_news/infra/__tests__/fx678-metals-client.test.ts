import { describe, expect, it } from "vitest"
import { beijingClockToThailand, parseFx678MetalsTable } from "@/modules/raw_material_news/infra/fx678-metals-client"

const html = `
<table id="LME">
  <tr id="LMAC">
    <td><a class="mar_name">LME合金</a></td>
    <td>2400.00</td>
    <td><span>0.00</span></td>
    <td>0.00%</td>
    <td>2400.00</td>
    <td>2400.00</td>
    <td>2400.00</td>
    <td>06:00:00</td>
  </tr>
  <tr id="LMCI">
    <td><a class="mar_name" href="https://quote.fx678.com/symbol/LMCI">LME铜</a></td>
    <td>14,015.50</td>
    <td><span class="arrow_green">-19.00</span></td>
    <td class="green_tab">-0.14%</td>
    <td>14052.00</td>
    <td>13956.00</td>
    <td>14034.50</td>
    <td>09:38:48</td>
  </tr>
</table>
<table id="WGJS">
  <tr id="GT">
    <td><a class="mar_name">香港黄金</a></td>
    <td>36666.70</td>
    <td><span class="arrow_red">229.51</span></td>
    <td class="red_tab">0.63%</td>
    <td>36727.79</td>
    <td>36347.51</td>
    <td>36437.18</td>
    <td>09:32:07</td>
  </tr>
  <tr id="XAU">
    <td><a class="mar_name">现货黄金</a></td>
    <td>3953.96</td>
    <td><span class="arrow_red">23.87</span></td>
    <td class="red_tab">0.61%</td>
    <td>3960.29</td>
    <td>3919.85</td>
    <td>3930.09</td>
    <td>00:10:00</td>
  </tr>
</table>
`

describe("beijingClockToThailand", () => {
  it("subtracts one hour and drops seconds", () => {
    expect(beijingClockToThailand("09:38:48")).toBe("08:38")
  })

  it("wraps midnight back to the previous evening", () => {
    expect(beijingClockToThailand("00:10:00")).toBe("23:10")
  })
})

describe("parseFx678MetalsTable", () => {
  it("reads known rows in display order and skips alloy and Hong Kong gold", () => {
    const quotes = parseFx678MetalsTable(html)
    expect(quotes.map((row) => row.name)).toEqual(["ทองแดง", "ทองคำ"])
    expect(quotes[0]).toEqual({
      name: "ทองแดง",
      month: null,
      last: 14015.5,
      change: -19,
      changePct: -0.14,
      time: "08:38",
    })
    expect(quotes[1]).toEqual({
      name: "ทองคำ",
      month: null,
      last: 3953.96,
      change: 23.87,
      changePct: 0.61,
      time: "23:10",
    })
  })

  it("returns no rows when the quote tables are missing", () => {
    expect(parseFx678MetalsTable("<div>ไม่มีตาราง</div>")).toEqual([])
  })
})
