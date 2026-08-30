import { describe, expect, it } from "vitest"
import {
  formatTransportDocumentNo,
  nextTransportDocumentNo,
  nextTransportDocumentNoFromLatest,
  parseTransportDocumentSeq,
  transportDocumentPrefix,
} from "@/modules/transport/application/transport-document-no"

describe("transport document numbers", () => {
  it("formats PREFIX-YYYY-NNNNN", () => {
    expect(formatTransportDocumentNo("RP", 1, 2026)).toBe("RP-2026-00001")
    expect(formatTransportDocumentNo("TY", 12, 2026)).toBe("TY-2026-00012")
    expect(formatTransportDocumentNo("TJ", 2, 2026)).toBe("TJ-2026-00002")
  })

  it("continues from the latest number of the same year prefix", () => {
    expect(nextTransportDocumentNoFromLatest("RP", null, 2026)).toBe("RP-2026-00001")
    expect(nextTransportDocumentNoFromLatest("RP", "RP-2026-00003", 2026)).toBe("RP-2026-00004")
    expect(nextTransportDocumentNoFromLatest("TY", "TY-2026-00001", 2026)).toBe("TY-2026-00002")
    expect(nextTransportDocumentNoFromLatest("TJ", "TJ-2026-00002", 2026)).toBe("TJ-2026-00003")
  })

  it("ignores a latest value from another prefix", () => {
    const prefix = transportDocumentPrefix("RP", 2026)
    expect(parseTransportDocumentSeq("TY-2026-00009", prefix)).toBe(0)
    expect(nextTransportDocumentNoFromLatest("RP", "TY-2026-00009", 2026)).toBe("RP-2026-00001")
  })

  it("asks findLatest with the current-year prefix then increments", async () => {
    let seenPrefix = ""
    const next = await nextTransportDocumentNo("TY", async (prefix) => {
      seenPrefix = prefix
      return "TY-2099-00007".replace("2099", prefix.slice(3, 7))
    })
    expect(seenPrefix).toBe(transportDocumentPrefix("TY"))
    expect(next).toBe(formatTransportDocumentNo("TY", 8))
  })
})
