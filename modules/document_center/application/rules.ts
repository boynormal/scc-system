export const EXPIRING_WITHIN_DAYS = 30
export const EMPTY_ID = "00000000-0000-0000-0000-000000000000"
export const DOC_GRID_PAGE_SIZE = 24

export type DocFileKind = "pdf" | "image" | "excel" | "word" | "powerpoint" | "other"
export type DocSort = "updated" | "name" | "code"
export type DocListMode = "all" | "mine" | "favorite" | "recent"

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,49}$/

export function normalizeTags(raw: string[] | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw ?? []) {
    const name = item.trim().toLowerCase().replace(/\s+/g, " ")
    if (!name || name.length > 40 || seen.has(name)) continue
    seen.add(name)
    out.push(name)
    if (out.length >= 20) break
  }
  return out
}

export function assertDocumentCode(code: string) {
  if (!CODE_PATTERN.test(code)) {
    throw new Error("INVALID_CODE")
  }
}

export function generatedDocumentCode(now = new Date()): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase().padEnd(4, "A")
  return `DC-${year}${month}-${suffix}`
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE")
  return new Date(`${value}T00:00:00.000Z`)
}

export function dateOnlyString(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function assertDateOrder(effective: Date | null, expiry: Date | null) {
  if (effective && expiry && effective.getTime() > expiry.getTime()) {
    throw new Error("DATE_ORDER")
  }
}

export type ParentRow = { id: string; parentId: string | null }

export function parentCreatesCycle(rows: ParentRow[], categoryId: string, nextParentId: string | null): boolean {
  if (!nextParentId) return false
  if (nextParentId === categoryId) return true
  const parentOf = new Map(rows.map((row) => [row.id, row.parentId]))
  let cursor: string | null = nextParentId
  const seen = new Set<string>()
  while (cursor) {
    if (cursor === categoryId || seen.has(cursor)) return true
    seen.add(cursor)
    cursor = parentOf.get(cursor) ?? null
  }
  return false
}

export function descendantIds(rows: ParentRow[], rootId: string): string[] {
  const children = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.parentId) continue
    const list = children.get(row.parentId) ?? []
    list.push(row.id)
    children.set(row.parentId, list)
  }
  const out: string[] = []
  const stack = [rootId]
  const seen = new Set<string>()
  while (stack.length) {
    const id = stack.pop()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    for (const child of children.get(id) ?? []) stack.push(child)
  }
  return out
}

export function rollupCategoryCounts(rows: ParentRow[], counts: Map<string, number>): Map<string, number> {
  const children = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.parentId) continue
    const list = children.get(row.parentId) ?? []
    list.push(row.id)
    children.set(row.parentId, list)
  }
  const memo = new Map<string, number>()
  const walk = (id: string, trail: Set<string>): number => {
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    if (trail.has(id)) return counts.get(id) ?? 0
    trail.add(id)
    let total = counts.get(id) ?? 0
    for (const child of children.get(id) ?? []) total += walk(child, trail)
    trail.delete(id)
    memo.set(id, total)
    return total
  }
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(row.id, walk(row.id, new Set()))
  return totals
}

export function fileKindOf(contentType: string | null | undefined, fileName: string | null | undefined): DocFileKind {
  const type = (contentType ?? "").toLowerCase()
  const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? ""
  if (type === "application/pdf" || ext === "pdf") return "pdf"
  if (type.startsWith("image/") || ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") return "image"
  if (type.includes("spreadsheet") || type.includes("ms-excel") || ext === "xlsx" || ext === "xls") return "excel"
  if (type.includes("wordprocessing") || type === "application/msword" || ext === "docx" || ext === "doc") return "word"
  if (type.includes("presentation") || type.includes("ms-powerpoint") || ext === "pptx" || ext === "ppt") return "powerpoint"
  return "other"
}

export function canPreviewKind(kind: DocFileKind): boolean {
  return kind === "pdf" || kind === "image"
}

export function contentTypesForKind(kind: DocFileKind): string[] | null {
  if (kind === "pdf") return ["application/pdf"]
  if (kind === "image") return ["image/jpeg", "image/png", "image/webp"]
  if (kind === "excel") {
    return [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ]
  }
  if (kind === "word") {
    return [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ]
  }
  if (kind === "powerpoint") {
    return [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
    ]
  }
  return null
}

export function isUniqueConflict(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002")
}

export function personName(user: { firstName: string; lastName: string } | null | undefined): string {
  if (!user) return ""
  return `${user.firstName} ${user.lastName}`.trim()
}

export function documentFilePath(documentId: string, versionId: string, disposition: "inline" | "attachment") {
  return `/api/document-center/documents/${documentId}/versions/${versionId}/file?disposition=${disposition}`
}

export type DocListItem = {
  id: string
  documentCode: string
  documentName: string
  description: string | null
  status: "ACTIVE" | "INACTIVE"
  tags: string[]
  categoryId: string
  categoryName: string
  typeId: string
  typeCode: string
  typeName: string
  branchId: string | null
  branchName: string | null
  departmentId: string | null
  departmentName: string | null
  effectiveDate: string | null
  expiryDate: string | null
  updatedAt: string
  createdById: string
  updatedByName: string
  versionId: string | null
  versionNumber: number | null
  fileName: string | null
  contentType: string | null
  sizeBytes: number | null
  fileKind: DocFileKind
  favorite: boolean
  deletedAt: string | null
  requiresAcknowledgement: boolean
  acknowledgedAt: string | null
}

export type DocVersionItem = {
  id: string
  versionNumber: number
  changeNote: string | null
  fileName: string | null
  contentType: string | null
  sizeBytes: number | null
  fileKind: DocFileKind
  uploadedByName: string
  uploadedAt: string
  isCurrent: boolean
}

export type DocSummary = {
  total: number
  active: number
  expiring: number
  favorites: number
}
