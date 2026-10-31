import { createHash, randomUUID } from "node:crypto"
import { ValidationError } from "@/lib/errors"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KEY_PART = /^[a-z0-9_-]{1,40}$/

const PDF = Buffer.from("%PDF-")
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

type AllowedKind = { ext: "pdf" | "jpg" | "png" | "webp"; contentType: string }

function kindOf(body: Buffer): AllowedKind | null {
  if (body.length >= PDF.length && body.subarray(0, PDF.length).equals(PDF)) {
    return { ext: "pdf", contentType: "application/pdf" }
  }
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" }
  }
  if (body.length >= PNG.length && body.subarray(0, PNG.length).equals(PNG)) {
    return { ext: "png", contentType: "image/png" }
  }
  if (
    body.length >= 12 &&
    body.subarray(0, 4).toString("latin1") === "RIFF" &&
    body.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return { ext: "webp", contentType: "image/webp" }
  }
  return null
}

function looksActive(body: Buffer): boolean {
  const head = body.subarray(0, 256).toString("utf8").trimStart().toLowerCase()
  return (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<svg") ||
    head.startsWith("<script") ||
    head.startsWith("<?xml")
  )
}

export function sha256Hex(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex")
}

export function safeOriginalName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? ""
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim()
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new ValidationError("ชื่อไฟล์ไม่ถูกต้อง")
  }
  return cleaned.slice(0, 255)
}

function declaredExtension(name: string): AllowedKind["ext"] | null {
  const ext = safeOriginalName(name).split(".").pop()?.toLowerCase() ?? ""
  if (ext === "jpeg" || ext === "jpg") return "jpg"
  if (ext === "png" || ext === "pdf" || ext === "webp") return ext
  return null
}

export function inspectUpload(body: Buffer, originalName: string, maxBytes: number): {
  originalName: string
  contentType: string
} {
  if (body.length === 0) throw new ValidationError("ไฟล์ว่าง")
  if (body.length > maxBytes) throw new ValidationError("ไฟล์ใหญ่เกินขนาดที่กำหนด")
  if (looksActive(body)) throw new ValidationError("ชนิดไฟล์นี้ไม่ได้รับอนุญาต")
  const detected = kindOf(body)
  const declared = declaredExtension(originalName)
  if (!detected || !declared || detected.ext !== declared) {
    throw new ValidationError("ชนิดไฟล์นี้ไม่ได้รับอนุญาต")
  }
  return { originalName: safeOriginalName(originalName), contentType: detected.contentType }
}

export function buildObjectKey(parts: {
  module: string
  entityType: string
  recordId: string
  fileId?: string
}): { fileId: string; objectKey: string } {
  if (!KEY_PART.test(parts.module) || !KEY_PART.test(parts.entityType)) {
    throw new ValidationError("ข้อมูลไฟล์ไม่ถูกต้อง")
  }
  if (!UUID.test(parts.recordId)) throw new ValidationError("ข้อมูลไฟล์ไม่ถูกต้อง")
  const fileId = parts.fileId ?? randomUUID()
  if (!UUID.test(fileId)) throw new ValidationError("ข้อมูลไฟล์ไม่ถูกต้อง")
  return {
    fileId,
    objectKey: `${parts.module}/${parts.entityType}/${parts.recordId}/${fileId}`,
  }
}

function contentDisposition(originalName: string, kind: "inline" | "attachment"): string {
  const stripped = originalName.replace(/[\r\n]/g, "")
  const ascii = stripped.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_").trim() || "file"
  const encoded = encodeURIComponent(stripped).replace(
    /['()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded || "file"}`
}

export function contentDispositionAttachment(originalName: string): string {
  return contentDisposition(originalName, "attachment")
}

export function contentDispositionInline(originalName: string): string {
  return contentDisposition(originalName, "inline")
}

const ZIP_LOCAL = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const CONTENT_TYPES = Buffer.from("[Content_Types].xml")
const VBA_PROJECT = Buffer.from("vbaProject.bin")

type DocumentExt = AllowedKind["ext"] | "xlsx" | "docx" | "pptx" | "xls" | "doc" | "ppt"

const DOCUMENT_CONTENT_TYPE: Record<DocumentExt, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  doc: "application/msword",
  ppt: "application/vnd.ms-powerpoint",
}

function startsWithBytes(body: Buffer, signature: Buffer): boolean {
  return body.length >= signature.length && body.subarray(0, signature.length).equals(signature)
}

function windowIncludes(body: Buffer, needle: Buffer, maxBytes: number): boolean {
  return body.subarray(0, Math.min(body.length, maxBytes)).includes(needle)
}

function documentExtension(name: string): DocumentExt | null {
  const ext = safeOriginalName(name).split(".").pop()?.toLowerCase() ?? ""
  if (ext === "jpeg" || ext === "jpg") return "jpg"
  if (
    ext === "png" ||
    ext === "pdf" ||
    ext === "webp" ||
    ext === "xlsx" ||
    ext === "docx" ||
    ext === "pptx" ||
    ext === "xls" ||
    ext === "doc" ||
    ext === "ppt"
  ) {
    return ext
  }
  return null
}

function officeBytesMatch(body: Buffer, ext: DocumentExt): boolean {
  if (ext === "xlsx" || ext === "docx" || ext === "pptx") {
    return (
      startsWithBytes(body, ZIP_LOCAL) &&
      windowIncludes(body, CONTENT_TYPES, 256 * 1024) &&
      !windowIncludes(body, VBA_PROJECT, 512 * 1024)
    )
  }
  if (ext === "xls" || ext === "doc" || ext === "ppt") return startsWithBytes(body, OLE)
  return false
}

/**
 * Document Center upload check. Finance keeps using `inspectUpload` (PDF and images only).
 * Office Open XML must be a zip with `[Content_Types].xml`. Macro files are refused.
 */
export function inspectDocumentUpload(body: Buffer, originalName: string, maxBytes: number): {
  originalName: string
  contentType: string
} {
  if (body.length === 0) throw new ValidationError("ไฟล์ว่าง")
  if (body.length > maxBytes) throw new ValidationError("ไฟล์ใหญ่เกินขนาดที่กำหนด")
  if (looksActive(body)) throw new ValidationError("ชนิดไฟล์นี้ไม่ได้รับอนุญาต")
  const declared = documentExtension(originalName)
  if (!declared) throw new ValidationError("ชนิดไฟล์นี้ไม่ได้รับอนุญาต")
  if (declared === "xlsx" || declared === "docx" || declared === "pptx" || declared === "xls" || declared === "doc" || declared === "ppt") {
    if (!officeBytesMatch(body, declared)) throw new ValidationError("ชนิดไฟล์นี้ไม่ได้รับอนุญาต")
    return { originalName: safeOriginalName(originalName), contentType: DOCUMENT_CONTENT_TYPE[declared] }
  }
  const detected = kindOf(body)
  if (!detected || detected.ext !== declared) throw new ValidationError("ชนิดไฟล์นี้ไม่ได้รับอนุญาต")
  return { originalName: safeOriginalName(originalName), contentType: detected.contentType }
}
