import type { ModuleNavNode } from "./moduleRegistry"

type TranslateFn = (key: string) => string

/**
 * Resolve nav node `label` (stored as message key = node.key) via next-intl `nav` namespace.
 */
export function translateNavTree(nodes: ModuleNavNode[], t: TranslateFn): ModuleNavNode[] {
  return nodes.map((n) => {
    if (n.type === "link") {
      return { ...n, label: t(n.key) }
    }
    if (n.type === "group") {
      return {
        ...n,
        label: t(n.key),
        children: translateNavTree(n.children, t),
      }
    }
    return {
      ...n,
      label: t(n.key),
      children: translateNavTree(n.children, t),
    }
  })
}
