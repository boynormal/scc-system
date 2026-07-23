import type { ModuleNavNode } from "./moduleRegistry"

export type CompanyNavPreferences = {
  /** moduleId ที่ซ่อนทั้งโหนด (รวมกลุ่ม) */
  hiddenModuleIds: string[]
  /** แทนที่ลำดับการเรียงตาม moduleId */
  orderOverrides: Record<string, number>
  /** ปักหมุด tile บนหน้า /apps */
  pinnedModuleIds: string[]
  /** ซ่อนทั้งแผนกในหน้า /apps */
  hiddenDepartmentIds: string[]
  /** แทนที่ลำดับแผนกในหน้า /apps */
  departmentOrderOverrides: Record<string, number>
}

const empty: CompanyNavPreferences = {
  hiddenModuleIds: [],
  orderOverrides: {},
  pinnedModuleIds: [],
  hiddenDepartmentIds: [],
  departmentOrderOverrides: {},
}

/**
 * อ่านจาก `companies.settings` JSON — รูปแบบที่รองรับ:
 * `{ "nav": { "hiddenModuleIds": ["reports"], "orderOverrides": { "machines": 5 } } } }`
 */
export function parseCompanyNavPreferences(settings: unknown): CompanyNavPreferences {
  if (!settings || typeof settings !== "object") return { ...empty }
  const nav = (settings as Record<string, unknown>).nav
  if (!nav || typeof nav !== "object") return { ...empty }
  const n = nav as Record<string, unknown>
  const hiddenRaw = n.hiddenModuleIds
  const hiddenModuleIds = Array.isArray(hiddenRaw)
    ? hiddenRaw.filter((x): x is string => typeof x === "string")
    : []
  const orderRaw = n.orderOverrides
  const orderOverrides: Record<string, number> = {}
  if (orderRaw && typeof orderRaw === "object" && !Array.isArray(orderRaw)) {
    for (const [k, v] of Object.entries(orderRaw as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) orderOverrides[k] = v
    }
  }
  const pinnedRaw = n.pinnedModuleIds
  const pinnedModuleIds = Array.isArray(pinnedRaw)
    ? pinnedRaw.filter((x): x is string => typeof x === "string")
    : []
  const hiddenDepartmentRaw = n.hiddenDepartmentIds
  const hiddenDepartmentIds = Array.isArray(hiddenDepartmentRaw)
    ? hiddenDepartmentRaw.filter((x): x is string => typeof x === "string")
    : []
  const departmentOrderRaw = n.departmentOrderOverrides
  const departmentOrderOverrides: Record<string, number> = {}
  if (departmentOrderRaw && typeof departmentOrderRaw === "object" && !Array.isArray(departmentOrderRaw)) {
    for (const [k, v] of Object.entries(departmentOrderRaw as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) departmentOrderOverrides[k] = v
    }
  }
  return {
    hiddenModuleIds,
    orderOverrides,
    pinnedModuleIds,
    hiddenDepartmentIds,
    departmentOrderOverrides,
  }
}

function sortKey(node: ModuleNavNode, orderOverrides: Record<string, number>): number {
  if (node.type === "section") return node.order ?? 500
  const o = orderOverrides[node.moduleId]
  if (typeof o === "number") return o
  return node.order ?? 500
}

export function sortNavTree(
  nodes: ModuleNavNode[],
  orderOverrides: Record<string, number> = {}
): ModuleNavNode[] {
  return [...nodes]
    .sort((a, b) => {
      const d = sortKey(a, orderOverrides) - sortKey(b, orderOverrides)
      if (d !== 0) return d
      return a.key.localeCompare(b.key)
    })
    .map((n) => {
      if (n.type === "section" || n.type === "group") {
        return { ...n, children: sortNavTree(n.children, orderOverrides) } as ModuleNavNode
      }
      return n
    })
}

export function applyCompanyNavOverrides(
  nodes: ModuleNavNode[],
  prefs: CompanyNavPreferences
): ModuleNavNode[] {
  const hidden = new Set(prefs.hiddenModuleIds)

  function filterOne(n: ModuleNavNode): ModuleNavNode | null {
    if (n.type === "link") {
      if (hidden.has(n.moduleId)) return null
      return n
    }
    if (n.type === "group") {
      if (hidden.has(n.moduleId)) return null
      const children = n.children.map(filterOne).filter((c): c is ModuleNavNode => c !== null)
      if (!children.length) return null
      return { ...n, children }
    }
    if (n.type === "section") {
      const children = n.children.map(filterOne).filter((c): c is ModuleNavNode => c !== null)
      if (!children.length) return null
      return { ...n, children }
    }
    return null
  }

  return nodes.map(filterOne).filter((c): c is ModuleNavNode => c !== null)
}
