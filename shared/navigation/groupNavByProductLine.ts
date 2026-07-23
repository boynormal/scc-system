import type { ModuleNavNode } from "./moduleRegistry"
import { PRODUCT_LINE_REGISTRY, type ProductLineDef } from "./productLineRegistry"

export function pathMatchesHref(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

/** คืน href ที่ match path ปัจจุบันมากที่สุด (กัน parent เช่น /transport ถูก highlight คู่กับ /transport/master-data) */
export function resolveActiveNavHref(pathname: string, nodes: ModuleNavNode[]): string | null {
  let best: string | null = null
  let bestLen = -1

  const visit = (list: ModuleNavNode[]) => {
    for (const n of list) {
      if (n.type === "link") {
        if (pathMatchesHref(pathname, n.href) && n.href.length > bestLen) {
          best = n.href
          bestLen = n.href.length
        }
      } else if (n.type === "group" || n.type === "section") {
        visit(n.children)
      }
    }
  }

  visit(nodes)
  return best
}

export function subtreeContainsActiveHref(node: ModuleNavNode, activeHref: string | null): boolean {
  if (!activeHref) return false
  if (node.type === "link") return node.href === activeHref
  if (node.type === "group" || node.type === "section") {
    return node.children.some((c) => subtreeContainsActiveHref(c, activeHref))
  }
  return false
}

function departmentIdsForProductLine(productLineId: string): Set<string> {
  const line = PRODUCT_LINE_REGISTRY.find((p) => p.id === productLineId)
  return new Set(line?.departmentIds ?? [])
}

function departmentToProductLineId(deptId: string): string | null {
  for (const line of PRODUCT_LINE_REGISTRY) {
    if (line.departmentIds.includes(deptId)) return line.id
  }
  return null
}

function filterNodeByDepartments(
  node: ModuleNavNode,
  allowedDepartments: Set<string>,
  parentDepartmentId?: string
): ModuleNavNode | null {
  if (node.type === "link") {
    const dept = node.launcher?.departmentId ?? parentDepartmentId
    if (!dept || !allowedDepartments.has(dept)) return null
    return node
  }

  if (node.type === "group") {
    const nextParent = node.launcher?.departmentId ?? parentDepartmentId
    const children = node.children
      .map((c) => filterNodeByDepartments(c, allowedDepartments, nextParent))
      .filter((c): c is ModuleNavNode => c !== null)
    if (children.length === 0) return null
    return { ...node, children }
  }

  if (node.type === "section") {
    const children = node.children
      .map((c) => filterNodeByDepartments(c, allowedDepartments, parentDepartmentId))
      .filter((c): c is ModuleNavNode => c !== null)
    if (children.length === 0) return null
    return { ...node, children }
  }

  return null
}

export function filterNavByProductLine(navItems: ModuleNavNode[], productLineId: string): ModuleNavNode[] {
  const allowed = departmentIdsForProductLine(productLineId)
  return navItems
    .map((n) => filterNodeByDepartments(n, allowed))
    .filter((n): n is ModuleNavNode => n !== null)
}

function treeHasLink(nodes: ModuleNavNode[]): boolean {
  for (const n of nodes) {
    if (n.type === "link") return true
    if (n.type === "group" || n.type === "section") {
      if (treeHasLink(n.children)) return true
    }
  }
  return false
}

export function getVisibleProductLines(navItems: ModuleNavNode[]): ProductLineDef[] {
  return PRODUCT_LINE_REGISTRY.filter((line) => treeHasLink(filterNavByProductLine(navItems, line.id)))
}

export function resolveActiveProductLineId(pathname: string, navItems: ModuleNavNode[]): string | null {
  const activeHref = resolveActiveNavHref(pathname, navItems)
  if (!activeHref) return null

  let found: string | null = null

  const visit = (node: ModuleNavNode, parentDepartmentId?: string) => {
    if (node.type === "link") {
      const dept = node.launcher?.departmentId ?? parentDepartmentId
      if (dept && node.href === activeHref) {
        found = departmentToProductLineId(dept)
      }
      return
    }

    const nextParent =
      node.type === "group" ? (node.launcher?.departmentId ?? parentDepartmentId) : parentDepartmentId

    if (node.type === "group" || node.type === "section") {
      node.children.forEach((c) => visit(c, nextParent))
    }
  }

  navItems.forEach((n) => visit(n))
  return found
}
