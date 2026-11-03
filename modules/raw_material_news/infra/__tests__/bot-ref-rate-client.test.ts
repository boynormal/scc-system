import { deflateRawSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import {
  parseUsdBuyingTransfer,
  weightedRateFromZip,
} from "@/modules/raw_material_news/infra/bot-ref-rate-client"

const csv = `อัตราแลกเปลี่ยนเงินตราต่างประเทศ ประจำวันที่   2 พฤศจิกายน 2569
อัตราแลกเปลี่ยนถัวเฉลี่ยถ่วงน้ำหนักระหว่างธนาคาร = 33.785 บาท ต่อ 1 ดอลลาร์ สรอ.
สหรัฐอเมริกา|USD|33.5166|33.6080|33.9422
`

function storedZip(name: string, content: Buffer): Buffer {
  const nameBuf = Buffer.from(name)
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt32LE(content.length, 18)
  header.writeUInt32LE(content.length, 22)
  header.writeUInt16LE(nameBuf.length, 26)
  return Buffer.concat([header, nameBuf, content])
}

function deflatedZip(name: string, content: Buffer): Buffer {
  const nameBuf = Buffer.from(name)
  const compressed = deflateRawSync(content)
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(8, 8)
  header.writeUInt32LE(compressed.length, 18)
  header.writeUInt32LE(content.length, 22)
  header.writeUInt16LE(nameBuf.length, 26)
  return Buffer.concat([header, nameBuf, compressed])
}

describe("parseUsdBuyingTransfer", () => {
  it("uses the USD transfer buying rate, not the weighted interbank line", () => {
    expect(parseUsdBuyingTransfer(csv, "2026-11-02")).toEqual({ period: "2026-11-02", rate: 33.608 })
  })

  it("returns null when the USD row or the date is missing", () => {
    expect(parseUsdBuyingTransfer("ไม่มีอัตรา", "2026-11-02")).toBeNull()
    expect(parseUsdBuyingTransfer(csv, "02-11-2026")).toBeNull()
  })
})

describe("weightedRateFromZip", () => {
  const encoded = new TextEncoder().encode(csv)

  it("reads a stored ER_CSV1 entry and ignores other files", () => {
    const zip = Buffer.concat([
      storedZip("ER_CSV2_2026-11-02.csv", Buffer.from("other")),
      storedZip("ER_CSV1_2026-11-02.csv", Buffer.from(encoded)),
    ])
    expect(weightedRateFromZip(zip)).toEqual({ period: "2026-11-02", rate: 33.608 })
  })

  it("reads a deflated entry", () => {
    const zip = deflatedZip("ER_CSV1_2026-11-02.csv", Buffer.from(encoded))
    expect(weightedRateFromZip(zip)).toEqual({ period: "2026-11-02", rate: 33.608 })
  })
})
