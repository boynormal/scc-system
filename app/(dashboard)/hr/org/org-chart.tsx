"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, FileText, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { GlassCard } from "@/components/glass"
import { Badge } from "@/components/ui/badge"
import type { OrgChartNode, PersonnelOrgChart } from "@/modules/hr"

function matches(node: OrgChartNode, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  if (node.name.toLowerCase().includes(q)) return true
  if (node.code?.toLowerCase().includes(q)) return true
  if (node.department?.name.toLowerCase().includes(q)) return true
  return node.occupants.some(
    (o) =>
      o.displayName.toLowerCase().includes(q) ||
      o.rosterNo.toLowerCase().includes(q) ||
      (o.jobGroup?.toLowerCase().includes(q) ?? false)
  )
}

function collectIds(nodes: OrgChartNode[]): string[] {
  const out: string[] = []
  const walk = (list: OrgChartNode[]) => {
    for (const node of list) {
      out.push(node.id)
      walk(node.children)
    }
  }
  walk(nodes)
  return out
}

function OccupantLines({ node }: { node: OrgChartNode }) {
  if (node.occupants.length === 0) {
    return <p className="text-xs italic text-muted-foreground">ยังไม่มีผู้ดำรงตำแหน่ง</p>
  }
  return (
    <ul className="space-y-0.5">
      {node.occupants.map((o) => (
        <li key={o.id} className="flex items-baseline gap-1.5 text-xs">
          <span className={cn("truncate", !o.isActive && "text-muted-foreground line-through")}>
            {o.displayName}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{o.rosterNo}</span>
        </li>
      ))}
    </ul>
  )
}

function PositionBox({
  node,
  selected,
  highlighted,
  collapsed,
  onSelect,
  onToggle,
}: {
  node: OrgChartNode
  selected: boolean
  highlighted: boolean
  collapsed: boolean
  onSelect: () => void
  onToggle: () => void
}) {
  const hiddenCount = node.subtreeSize - 1

  return (
    <div
      className={cn(
        "w-56 rounded-lg border bg-background/95 px-3 py-2 text-left shadow-sm transition-colors",
        selected ? "border-blue-500 ring-2 ring-blue-500/40" : "border-border",
        highlighted && !selected && "border-amber-400 ring-2 ring-amber-300/50",
        !node.isActive && "opacity-60"
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="flex items-start justify-between gap-1.5">
          <span className="text-sm font-semibold leading-snug text-foreground">{node.name}</span>
          {node.responsibilities.length > 0 && (
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </div>
        {(node.code || node.department) && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {[node.code, node.department?.name].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-1.5 border-t border-border/60 pt-1.5">
          <OccupantLines node={node} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {node.vacancy > 0 && <Badge variant="warning">ว่าง {node.vacancy}</Badge>}
          {node.headcount !== 1 && (
            <span className="text-[10px] text-muted-foreground">อัตรา {node.headcount}</span>
          )}
          {!node.isActive && <Badge variant="outline">ปิด</Badge>}
        </div>
      </button>

      {node.children.length > 0 && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md border border-border/60 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
        >
          {collapsed ? (
            <>
              <ChevronRight className="h-3 w-3" />
              แสดง {hiddenCount} ตำแหน่ง
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              ยุบ
            </>
          )}
        </button>
      )}
    </div>
  )
}

function ChartNode({
  node,
  collapsedIds,
  selectedId,
  query,
  onSelect,
  onToggle,
}: {
  node: OrgChartNode
  collapsedIds: Set<string>
  selectedId: string | null
  query: string
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}) {
  const collapsed = collapsedIds.has(node.id)
  const showChildren = !collapsed && node.children.length > 0

  return (
    <div className="flex flex-col items-center">
      <PositionBox
        node={node}
        selected={selectedId === node.id}
        highlighted={matches(node, query)}
        collapsed={collapsed}
        onSelect={() => onSelect(node.id)}
        onToggle={() => onToggle(node.id)}
      />

      {showChildren && (
        <>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-start">
            {node.children.map((child, index) => (
              <div key={child.id} className="flex flex-col items-center px-2">
                <div className="flex h-px w-full">
                  <div className={cn("flex-1", index > 0 && "bg-border")} />
                  <div className={cn("flex-1", index < node.children.length - 1 && "bg-border")} />
                </div>
                <div className="h-5 w-px bg-border" />
                <ChartNode
                  node={child}
                  collapsedIds={collapsedIds}
                  selectedId={selectedId}
                  query={query}
                  onSelect={onSelect}
                  onToggle={onToggle}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function IndentedNode({
  node,
  collapsedIds,
  selectedId,
  query,
  onSelect,
  onToggle,
}: {
  node: OrgChartNode
  collapsedIds: Set<string>
  selectedId: string | null
  query: string
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}) {
  const collapsed = collapsedIds.has(node.id)
  return (
    <li>
      <div style={{ paddingLeft: `${node.depth * 14}px` }}>
        <PositionBox
          node={node}
          selected={selectedId === node.id}
          highlighted={matches(node, query)}
          collapsed={collapsed}
          onSelect={() => onSelect(node.id)}
          onToggle={() => onToggle(node.id)}
        />
      </div>
      {!collapsed && node.children.length > 0 && (
        <ul className="mt-2 space-y-2">
          {node.children.map((child) => (
            <IndentedNode
              key={child.id}
              node={child}
              collapsedIds={collapsedIds}
              selectedId={selectedId}
              query={query}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function OrgChart({ chart, search }: { chart: PersonnelOrgChart; search: string }) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const flat = useMemo(() => {
    const out = new Map<string, OrgChartNode>()
    const walk = (nodes: OrgChartNode[]) => {
      for (const node of nodes) {
        out.set(node.id, node)
        walk(node.children)
      }
    }
    walk(chart.roots)
    return out
  }, [chart.roots])

  const selected = selectedId ? flat.get(selectedId) ?? null : null

  function toggle(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (chart.roots.length === 0) {
    return (
      <GlassCard className="px-5 py-12 text-center">
        <p className="text-sm font-medium text-foreground">สาขานี้ยังไม่มีตำแหน่ง</p>
        <p className="mt-1 text-sm text-muted-foreground">
          สร้างตำแหน่งที่แท็บ &ldquo;ตำแหน่ง&rdquo; แล้วผังจะขึ้นที่นี่ — ระหว่างนี้ดูมุมมองแผนกได้
        </p>
      </GlassCard>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="lg:order-2">
        <GlassCard padding="sm" className="lg:sticky lg:top-4">
          {selected ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[selected.code, selected.department?.name].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-border/60 py-1.5">
                  <p className="text-sm font-semibold text-foreground">{selected.headcount}</p>
                  <p className="text-[10px] text-muted-foreground">อัตรา</p>
                </div>
                <div className="rounded-md border border-border/60 py-1.5">
                  <p className="text-sm font-semibold text-foreground">
                    {selected.occupants.filter((o) => o.isActive).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">นั่งอยู่</p>
                </div>
                <div className="rounded-md border border-border/60 py-1.5">
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {selected.vacancy}
                  </p>
                  <p className="text-[10px] text-muted-foreground">ว่าง</p>
                </div>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Users className="h-3.5 w-3.5" />
                  ผู้ดำรงตำแหน่ง
                </p>
                <OccupantLines node={selected} />
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  หน้าที่ความรับผิดชอบ
                </p>
                {selected.responsibilities.length > 0 ? (
                  <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
                    {selected.responsibilities.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs italic text-muted-foreground">ยังไม่ได้บันทึก</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">แตะกล่องเพื่อดูรายละเอียด</p>
              <p className="text-xs text-muted-foreground">
                แผงนี้จะแสดงอัตรากำลัง ผู้ดำรงตำแหน่ง และหน้าที่ความรับผิดชอบ
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCollapsedIds(new Set())}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  ขยายทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedIds(
                      new Set(collectIds(chart.roots).filter((id) => flat.get(id)?.children.length))
                    )
                  }
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  ยุบทั้งหมด
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      <div className="min-w-0 lg:order-1">
        <GlassCard padding="sm" className="hidden overflow-x-auto lg:block">
          <div className="flex min-w-max items-start gap-8 px-4 py-4">
            {chart.roots.map((root) => (
              <ChartNode
                key={root.id}
                node={root}
                collapsedIds={collapsedIds}
                selectedId={selectedId}
                query={search}
                onSelect={setSelectedId}
                onToggle={toggle}
              />
            ))}
          </div>
        </GlassCard>

        <ul className="space-y-2 lg:hidden">
          {chart.roots.map((root) => (
            <IndentedNode
              key={root.id}
              node={root}
              collapsedIds={collapsedIds}
              selectedId={selectedId}
              query={search}
              onSelect={setSelectedId}
              onToggle={toggle}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

export function UnplacedPersonnel({ chart }: { chart: PersonnelOrgChart }) {
  if (chart.unplaced.length === 0) return null
  return (
    <GlassCard padding="sm">
      <p className="text-sm font-semibold text-foreground">
        ยังไม่จัดตำแหน่ง ({chart.unplaced.length})
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        คนเหล่านี้อยู่ในสาขานี้แต่ยังไม่ถูกผูกกับตำแหน่งในผัง
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chart.unplaced.map((o) => (
          <span
            key={o.id}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground"
          >
            {o.displayName}
            <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{o.rosterNo}</span>
          </span>
        ))}
      </div>
    </GlassCard>
  )
}
