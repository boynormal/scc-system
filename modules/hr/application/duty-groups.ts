export type DutyItemRef = {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
  category: { id: string; name: string; sortOrder: number }
}

export type DutyGroup = {
  categoryId: string
  category: string
  items: { id: string; name: string; isActive: boolean }[]
}

/** เรียงตามลำดับในสมุดเท่านั้น — ตารางเชื่อมไม่มีลำดับของตัวเอง */
export function groupDutyItems(items: DutyItemRef[]): DutyGroup[] {
  const sorted = [...items].sort((a, b) => {
    if (a.category.sortOrder !== b.category.sortOrder) return a.category.sortOrder - b.category.sortOrder
    const byCategory = a.category.name.localeCompare(b.category.name, "th")
    if (byCategory !== 0) return byCategory
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.name.localeCompare(b.name, "th")
  })
  const groups: DutyGroup[] = []
  for (const item of sorted) {
    let group = groups.at(-1)
    if (!group || group.categoryId !== item.category.id) {
      group = { categoryId: item.category.id, category: item.category.name, items: [] }
      groups.push(group)
    }
    group.items.push({ id: item.id, name: item.name, isActive: item.isActive })
  }
  return groups
}

/** ข้อความหลายบรรทัดสำหรับ Excel — บรรทัดละข้อ นำหน้าด้วยหมวดเพื่อให้กรองได้ */
export function formatDutyText(groups: DutyGroup[], lines: string[]): string {
  return [
    ...groups.flatMap((group) => group.items.map((item) => `${group.category}: ${item.name}`)),
    ...lines,
  ].join("\n")
}

export function splitLines(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export const dutyItemRefSelect = {
  id: true,
  name: true,
  sortOrder: true,
  isActive: true,
  category: { select: { id: true, name: true, sortOrder: true } },
} as const

export type DutyImportRow = { category: string; item: string | null }

/**
 * วางจาก Excel สองคอลัมน์ หมวด กับ รายการ — แถวที่หมวดว่างใช้หมวดของแถวก่อน
 * ตรงกับไฟล์ที่ผสานเซลล์หมวดไว้
 */
export function parseDutyImport(text: string): DutyImportRow[] {
  const rows: DutyImportRow[] = []
  let current: string | null = null
  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    if (!rawLine.trim()) continue
    const cells = rawLine.split("\t").map((cell) => cell.trim())
    if (cells.length === 1 && !current) {
      current = cells[0]!
      rows.push({ category: current, item: null })
      continue
    }
    const categoryCell = cells.length > 1 ? cells[0]! : ""
    const itemCell = cells.length > 1 ? cells.slice(1).find((cell) => cell.length > 0) ?? "" : cells[0]!
    if (categoryCell) current = categoryCell
    if (!current) continue
    rows.push({ category: current, item: itemCell || null })
  }
  return rows
}
