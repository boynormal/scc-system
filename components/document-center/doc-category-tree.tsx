import Link from "next/link"
import { DataPanel } from "@/components/shell/data-panel"
import { docHref } from "./doc-href"

export type DocTreeNode = {
  id: string
  parentId: string | null
  name: string
  isActive: boolean
  count: number
}

export function DocCategoryTree({
  nodes,
  pathname,
  query,
  title,
  emptyLabel,
}: {
  nodes: DocTreeNode[]
  pathname: string
  query: Record<string, string | undefined>
  title: string
  emptyLabel: string
}) {
  const selected = query.category
  const childrenOf = (parentId: string | null) => nodes.filter((node) => node.parentId === parentId)
  const render = (parentId: string | null, depth: number) =>
    childrenOf(parentId).map((node) => (
      <div key={node.id}>
        <Link
          href={docHref(pathname, query, { category: selected === node.id ? null : node.id, page: null, selected: null })}
          className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-foreground ${selected === node.id ? "bg-muted" : "hover:bg-muted/70"} ${node.isActive ? "" : "opacity-60"}`}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          <span className="min-w-0 truncate">{node.name}</span>
          <span className="shrink-0 tabular-nums">{node.count.toLocaleString()}</span>
        </Link>
        {render(node.id, depth + 1)}
      </div>
    ))

  return (
    <DataPanel padding="sm" className="hidden lg:block">
      <h2 className="mb-2 px-2 text-sm font-semibold text-foreground">{title}</h2>
      {nodes.length === 0 ? <p className="px-2 text-sm text-muted-foreground">{emptyLabel}</p> : render(null, 0)}
    </DataPanel>
  )
}
