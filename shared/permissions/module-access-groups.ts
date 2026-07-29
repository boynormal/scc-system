import { MODULE_NAV_REGISTRY, type ModuleNavNode } from "@/shared/navigation/moduleRegistry"

export type ModuleAccessGroup = {
  group: string
  modules: { id: string; label: string }[]
}

function walk(
  nodes: ModuleNavNode[],
  groupLabel: string,
  acc: Map<string, { group: string; label: string }>
) {
  for (const node of nodes) {
    if (node.type === "section") {
      walk(node.children, node.label, acc)
      continue
    }
    if (node.type === "group") {
      const nextGroup = node.label || groupLabel
      if (!acc.has(node.moduleId)) {
        acc.set(node.moduleId, { group: nextGroup, label: node.label })
      }
      walk(node.children, nextGroup, acc)
      continue
    }
    // link
    if (!acc.has(node.moduleId)) {
      acc.set(node.moduleId, { group: groupLabel, label: node.label })
    }
  }
}

/** Module visibility options for Role/User pickers — derived from nav registry */
export function getModuleAccessGroups(): ModuleAccessGroup[] {
  const acc = new Map<string, { group: string; label: string }>()
  walk(MODULE_NAV_REGISTRY, "อื่นๆ", acc)

  const byGroup = new Map<string, { id: string; label: string }[]>()
  for (const [id, meta] of acc) {
    const list = byGroup.get(meta.group) ?? []
    list.push({ id, label: meta.label })
    byGroup.set(meta.group, list)
  }

  return Array.from(byGroup.entries()).map(([group, modules]) => ({
    group,
    modules: modules.sort((a, b) => a.label.localeCompare(b.label, "th")),
  }))
}
