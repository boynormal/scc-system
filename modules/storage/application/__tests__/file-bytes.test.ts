import { describe, expect, it } from "vitest"
import { ValidationError } from "@/lib/errors"
import {
  buildObjectKey,
  contentDispositionAttachment,
  inspectDocumentUpload,
  inspectUpload,
  sha256Hex,
} from "@/modules/storage/application/file-bytes"

const MAX = 32

function pdf(): Buffer {
  return Buffer.from("%PDF-1.4 test")
}

describe("sha256Hex", () => {
  it("matches the known digest for abc", () => {
    expect(sha256Hex(Buffer.from("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
  })
})

describe("inspectUpload", () => {
  it("accepts a pdf whose bytes match the extension", () => {
    const result = inspectUpload(pdf(), "receipt.pdf", MAX)
    expect(result.contentType).toBe("application/pdf")
    expect(result.originalName).toBe("receipt.pdf")
  })

  it("rejects empty, oversized, html, svg, and mismatched types", () => {
    expect(() => inspectUpload(Buffer.alloc(0), "a.pdf", MAX)).toThrow(ValidationError)
    expect(() => inspectUpload(Buffer.from("%PDF-" + "x".repeat(40)), "a.pdf", MAX)).toThrow(/ใหญ่เกิน/)
    expect(() => inspectUpload(Buffer.from("<html>x</html>"), "a.pdf", MAX)).toThrow(/ไม่ได้รับอนุญาต/)
    expect(() => inspectUpload(Buffer.from("<svg xmlns='x'></svg>"), "a.svg", MAX)).toThrow(/ไม่ได้รับอนุญาต/)
    expect(() => inspectUpload(pdf(), "photo.jpg", MAX)).toThrow(/ไม่ได้รับอนุญาต/)
    expect(() => inspectUpload(Buffer.from([0x50, 0x4b, 0x03, 0x04]), "sheet.xlsx", MAX)).toThrow(/ไม่ได้รับอนุญาต/)
  })

  it("keeps only the file name and strips control characters", () => {
    const result = inspectUpload(pdf(), "C:\\temp\\..\\receipt.pdf", MAX)
    expect(result.originalName).toBe("receipt.pdf")
    const named = inspectUpload(pdf(), "a\r\nb.pdf", MAX)
    expect(named.originalName).not.toMatch(/[\r\n]/)
  })
})

describe("buildObjectKey", () => {
  it("builds a server key and rejects client path input", () => {
    const recordId = "44444444-4444-4444-4444-444444444444"
    const fileId = "55555555-5555-5555-5555-555555555555"
    expect(
      buildObjectKey({ module: "finance", entityType: "expense", recordId, fileId }).objectKey
    ).toBe(`finance/expense/${recordId}/${fileId}`)
    expect(() =>
      buildObjectKey({ module: "../finance", entityType: "expense", recordId, fileId })
    ).toThrow(ValidationError)
    expect(() =>
      buildObjectKey({ module: "finance", entityType: "expense", recordId: "../etc", fileId })
    ).toThrow(ValidationError)
  })
})

describe("inspectDocumentUpload", () => {
  function zipNamed(name: string) {
    const nameBuf = Buffer.from(name)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(nameBuf.length, 26)
    header.writeUInt32LE(4, 18)
    return Buffer.concat([header, nameBuf, Buffer.from("data")])
  }

  it("accepts pdf, images, and office containers that match the extension", () => {
    expect(inspectDocumentUpload(pdf(), "manual.pdf", MAX).contentType).toBe("application/pdf")
    const docx = zipNamed("[Content_Types].xml")
    expect(inspectDocumentUpload(docx, "policy.docx", 200).contentType).toContain("wordprocessingml")
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])
    expect(inspectDocumentUpload(ole, "legacy.xls", MAX).contentType).toBe("application/vnd.ms-excel")
  })

  it("rejects macro files, html, and a zip renamed as pdf", () => {
    const macro = Buffer.concat([zipNamed("[Content_Types].xml"), Buffer.from("vbaProject.bin")])
    expect(() => inspectDocumentUpload(macro, "book.xlsx", 400)).toThrow(ValidationError)
    expect(() => inspectDocumentUpload(Buffer.from("<html>x</html>"), "a.docx", MAX)).toThrow(ValidationError)
    expect(() => inspectDocumentUpload(zipNamed("[Content_Types].xml"), "a.pdf", 200)).toThrow(ValidationError)
    expect(() => inspectDocumentUpload(zipNamed("word/document.xml"), "a.docx", 200)).toThrow(ValidationError)
  })
})

describe("contentDispositionAttachment", () => {
  it("strips header injection characters", () => {
    const header = contentDispositionAttachment('evil\r\nX-Injected: yes".pdf')
    expect(header).not.toMatch(/[\r\n]/)
    expect(header.startsWith("attachment;")).toBe(true)
    expect(header).not.toContain('yes"')
  })
})
