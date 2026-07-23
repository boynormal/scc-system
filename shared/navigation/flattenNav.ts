import type { ModuleNavNode, NavIconKey, NavLauncherMeta } from "./moduleRegistry"

function launcherSortOrder(node: { order?: number; launcher?: NavLauncherMeta }): number {
  const lo = node.launcher?.launcherOrder
  if (typeof lo === "number" && Number.isFinite(lo)) return lo
  return node.order ?? 500
}

export type FlatNavItem = {
  href: string
  label: string
  moduleId: string
  keywords: string[]
  /** ข้อความรวมสำหรับค้นหา */
  searchText: string
}

export type LauncherAppItem = {
  moduleId: string
  label: string
  href: string
  icon: NavIconKey
  departmentId: string
  capabilityId: string
  order: number
  keywords: string[]
  searchText: string
  isPrimary: boolean
  badgeKey?: string
}

function pushLink(
  out: FlatNavItem[],
  href: string,
  label: string,
  moduleId: string,
  keywords: string[] | undefined,
  breadcrumb: string[]
) {
  const kw = keywords ?? []
  const searchText = [label, href, moduleId, ...breadcrumb, ...kw].join(" ").toLowerCase()
  out.push({
    href,
    label: breadcrumb.length ? `${breadcrumb.join(" › ")} › ${label}` : label,
    moduleId,
    keywords: kw,
    searchText,
  })
}

/**
 * แปลง tree เป็นรายการลิงก์สำหรับ command palette (เฉพาะ type link)
 */
export function flattenNavForPalette(nodes: ModuleNavNode[], breadcrumb: string[] = []): FlatNavItem[] {
  const out: FlatNavItem[] = []
  for (const n of nodes) {
    if (n.type === "link") {
      pushLink(out, n.href, n.label, n.moduleId, n.keywords, breadcrumb)
    } else if (n.type === "group") {
      const bc = [...breadcrumb, n.label]
      out.push(...flattenNavForPalette(n.children, bc))
    } else if (n.type === "section") {
      const bc = [...breadcrumb, n.label]
      out.push(...flattenNavForPalette(n.children, bc))
    }
  }
  return out
}

function firstLinkHref(nodes: ModuleNavNode[]): string | null {
  for (const n of nodes) {
    if (n.type === "link") return n.href
    if (n.type === "group" || n.type === "section") {
      const href = firstLinkHref(n.children)
      if (href) return href
    }
  }
  return null
}

/**
 * แปลง tree เป็นรายการ app tiles ระดับโมดูล (dedupe ด้วย moduleId)
 */
export function flattenNavForLauncher(nodes: ModuleNavNode[]): LauncherAppItem[] {
  const seen = new Set<string>()
  const out: LauncherAppItem[] = []

  const visit = (
    node: ModuleNavNode,
    parentDepartmentId?: string,
    parentCapabilityId?: string
  ) => {
    if (node.type === "link") {
      if (seen.has(node.moduleId)) return
      seen.add(node.moduleId)
      const departmentId = node.launcher?.departmentId ?? parentDepartmentId ?? "work_management"
      const capabilityId = node.launcher?.capabilityId ?? parentCapabilityId ?? "general"
      const keywords = node.keywords ?? []
      out.push({
        moduleId: node.moduleId,
        label: node.label,
        href: node.href,
        icon: node.icon,
        departmentId,
        capabilityId,
        order: launcherSortOrder(node),
        keywords,
        searchText: [node.label, node.href, node.moduleId, ...keywords, departmentId, capabilityId]
          .join(" ")
          .toLowerCase(),
        isPrimary: node.launcher?.isPrimary ?? false,
        badgeKey: node.launcher?.badgeKey,
      })
      return
    }

    if (node.type === "group") {
      if (!seen.has(node.moduleId)) {
        const href = firstLinkHref(node.children)
        if (href) {
          seen.add(node.moduleId)
          const departmentId = node.launcher?.departmentId ?? parentDepartmentId ?? "work_management"
          const capabilityId = node.launcher?.capabilityId ?? parentCapabilityId ?? "general"
          const keywords = node.keywords ?? []
          out.push({
            moduleId: node.moduleId,
            label: node.label,
            href,
            icon: node.icon,
            departmentId,
            capabilityId,
            order: launcherSortOrder(node),
            keywords,
            searchText: [node.label, href, node.moduleId, ...keywords, departmentId, capabilityId]
              .join(" ")
              .toLowerCase(),
            isPrimary: node.launcher?.isPrimary ?? false,
            badgeKey: node.launcher?.badgeKey,
          })
        }
      }
      node.children.forEach((c) =>
        visit(
          c,
          node.launcher?.departmentId ?? parentDepartmentId,
          node.launcher?.capabilityId ?? parentCapabilityId
        )
      )
      return
    }

    node.children.forEach((c) => visit(c, parentDepartmentId, parentCapabilityId))
  }

  nodes.forEach((n) => visit(n))
  return out.sort((a, b) => {
    const d = a.order - b.order
    if (d !== 0) return d
    return a.label.localeCompare(b.label)
  })
}
