"use client"

import Link from "next/link"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Clock,
  Database,
  Factory,
  LayoutDashboard,
  MapPin,
  Monitor,
  Package,
  Search,
  Settings,
  Sparkles,
  Star,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import type { LauncherAppItem } from "@/shared/navigation/flattenNav"
import type { NavIconKey } from "@/shared/navigation/moduleRegistry"
import { DEPARTMENT_BY_ID } from "@/shared/navigation/departmentRegistry"
import { PRODUCT_LINE_REGISTRY, type ProductLineDef } from "@/shared/navigation/productLineRegistry"
import { APP_BRAND } from "@/shared/branding"
import { cn } from "@/lib/utils"

const APP_ICON_MAP: Record<NavIconKey, LucideIcon> = {
  LayoutDashboard,
  Wrench,
  Factory,
  ClipboardList,
  Package,
  BarChart3,
  Bell,
  Settings,
  Users,
  Clock,
  Truck,
  MapPin,
  Monitor,
  CalendarDays,
  Database,
}

const LINE_HERO_ICONS: Record<ProductLineDef["iconKey"], LucideIcon> = {
  Wrench,
  Package,
  BarChart3,
  Settings,
  Users,
  Truck,
}

const LINE_CARD_THEMES: Record<
  string,
  { tile: string; icon: string; blob: string; ring: string; glow: string }
> = {
  maintenance_mgmt: {
    tile: "from-blue-50 via-indigo-50 to-violet-100 ring-indigo-200/60",
    icon: "from-blue-600 to-indigo-600",
    blob: "bg-indigo-400/30",
    ring: "ring-indigo-200/70",
    glow: "shadow-indigo-500/20",
  },
  people_time: {
    tile: "from-rose-50 via-orange-50 to-amber-100 ring-rose-200/60",
    icon: "from-rose-500 to-orange-500",
    blob: "bg-rose-400/30",
    ring: "ring-rose-200/70",
    glow: "shadow-rose-500/20",
  },
  inventory_spares: {
    tile: "from-emerald-50 via-teal-50 to-green-100 ring-emerald-200/60",
    icon: "from-emerald-500 to-teal-600",
    blob: "bg-emerald-400/30",
    ring: "ring-emerald-200/70",
    glow: "shadow-emerald-500/20",
  },
  transport_ops: {
    tile: "from-cyan-50 via-sky-50 to-blue-100 ring-cyan-200/60",
    icon: "from-cyan-500 to-blue-600",
    blob: "bg-cyan-400/30",
    ring: "ring-cyan-200/70",
    glow: "shadow-cyan-500/20",
  },
  settings_admin: {
    tile: "from-slate-50 via-zinc-100 to-slate-200 ring-slate-300/60",
    icon: "from-slate-600 to-zinc-700",
    blob: "bg-slate-400/25",
    ring: "ring-slate-300/70",
    glow: "shadow-slate-500/15",
  },
}

const TILE_SKINS = [
  {
    tile: "from-orange-50 to-amber-100 ring-orange-200/70",
    icon: "from-orange-500 to-amber-400 text-white",
    blob: "bg-orange-300/45",
  },
  {
    tile: "from-teal-50 to-cyan-100 ring-teal-200/70",
    icon: "from-teal-500 to-cyan-500 text-white",
    blob: "bg-teal-300/45",
  },
  {
    tile: "from-rose-50 to-pink-100 ring-rose-200/70",
    icon: "from-rose-500 to-pink-500 text-white",
    blob: "bg-rose-300/45",
  },
  {
    tile: "from-sky-50 to-blue-100 ring-sky-200/70",
    icon: "from-sky-500 to-blue-600 text-white",
    blob: "bg-sky-300/45",
  },
  {
    tile: "from-emerald-50 to-green-100 ring-emerald-200/70",
    icon: "from-emerald-500 to-green-500 text-white",
    blob: "bg-emerald-300/45",
  },
  {
    tile: "from-violet-50 to-fuchsia-100 ring-violet-200/70",
    icon: "from-violet-500 to-fuchsia-500 text-white",
    blob: "bg-violet-300/45",
  },
]

function lineTheme(lineId: string) {
  return LINE_CARD_THEMES[lineId] ?? LINE_CARD_THEMES.maintenance_mgmt
}

const MAX_CHIPS = 6

function getFavoriteIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem("apps.launcher.favorites")
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

function getRecentIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem("apps.launcher.recent")
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

function pushRecent(moduleId: string) {
  if (typeof window === "undefined") return
  const next = [moduleId, ...getRecentIds().filter((x) => x !== moduleId)].slice(0, 8)
  localStorage.setItem("apps.launcher.recent", JSON.stringify(next))
}

function setFavoriteIds(ids: string[]) {
  if (typeof window === "undefined") return
  localStorage.setItem("apps.launcher.favorites", JSON.stringify(ids))
}

function getCollapsedLineIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem("apps.launcher.collapsedLines")
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

function setCollapsedLineIds(ids: string[]) {
  if (typeof window === "undefined") return
  localStorage.setItem("apps.launcher.collapsedLines", JSON.stringify(ids))
}

function buildLineSections(
  line: ProductLineDef,
  grouped: Map<string, LauncherAppItem[]>,
  hiddenDepartments: Set<string>,
  departmentOrderOverrides: Record<string, number>
): { departmentId: string; label: string; apps: LauncherAppItem[] }[] {
  const seen = new Set<string>()
  const sections: { departmentId: string; label: string; apps: LauncherAppItem[] }[] = []

  for (const deptId of line.departmentIds) {
    if (hiddenDepartments.has(deptId)) continue
    const raw = grouped.get(deptId) ?? []
    const apps = raw.filter((app) => {
      if (seen.has(app.moduleId)) return false
      seen.add(app.moduleId)
      return true
    })
    if (apps.length === 0) continue
    sections.push({
      departmentId: deptId,
      label: DEPARTMENT_BY_ID[deptId]?.label ?? deptId,
      apps,
    })
  }

  sections.sort((a, b) => {
    const ao = departmentOrderOverrides[a.departmentId] ?? DEPARTMENT_BY_ID[a.departmentId]?.order ?? 999
    const bo = departmentOrderOverrides[b.departmentId] ?? DEPARTMENT_BY_ID[b.departmentId]?.order ?? 999
    if (ao !== bo) return ao - bo
    return a.label.localeCompare(b.label)
  })
  return sections
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size < 1) return [items]
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size))
  }
  return rows
}

function useGridColumns() {
  const [cols, setCols] = useState(1)

  useEffect(() => {
    const update = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) setCols(3)
      else if (window.matchMedia("(min-width: 640px)").matches) setCols(2)
      else setCols(1)
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return cols
}

function skinFor(moduleId: string) {
  const seed = moduleId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return TILE_SKINS[seed % TILE_SKINS.length]
}

export function AppsLauncher({
  apps,
  pinnedModuleIds,
  hiddenDepartmentIds,
  departmentOrderOverrides,
}: {
  apps: LauncherAppItem[]
  pinnedModuleIds: string[]
  hiddenDepartmentIds: string[]
  departmentOrderOverrides: Record<string, number>
}) {
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [favorites, setFavorites] = useState<string[]>([])
  const [recentIds, setRecentIds] = useState<string[]>([])
  // เริ่มต้นหุบทุกสายงาน — hydrate จาก localStorage ใน effect
  const [collapsedLines, setCollapsedLines] = useState<Set<string>>(
    () => new Set(PRODUCT_LINE_REGISTRY.map((l) => l.id))
  )

  useEffect(() => {
    setFavorites(getFavoriteIds())
    setRecentIds(getRecentIds())
    const stored = getCollapsedLineIds()
    if (stored.length > 0) {
      setCollapsedLines(new Set(stored))
    }
    // ถ้า stored ว่าง = first visit → คงค่าเริ่มต้น "หุบทั้งหมด" จาก useState
  }, [])

  const toggleLine = (lineId: string) => {
    setCollapsedLines((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) {
        next.delete(lineId)
      } else {
        next.add(lineId)
      }
      setCollapsedLineIds([...next])
      return next
    })
  }

  const combinedPinned = useMemo(() => new Set<string>([...pinnedModuleIds, ...favorites]), [favorites, pinnedModuleIds])

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    if (!q) return apps
    return apps.filter((app) => app.searchText.includes(q))
  }, [apps, deferredSearch])

  const grouped = useMemo(() => {
    const hiddenDepartments = new Set(hiddenDepartmentIds)
    const groups = new Map<string, LauncherAppItem[]>()
    const sorted = [...filtered].sort((a, b) => {
      const aPinned = combinedPinned.has(a.moduleId) || a.isPrimary
      const bPinned = combinedPinned.has(b.moduleId) || b.isPrimary
      if (aPinned !== bPinned) return aPinned ? -1 : 1
      const orderDiff = a.order - b.order
      if (orderDiff !== 0) return orderDiff
      return a.label.localeCompare(b.label)
    })

    for (const app of sorted) {
      if (hiddenDepartments.has(app.departmentId)) continue
      const items = groups.get(app.departmentId) ?? []
      items.push(app)
      groups.set(app.departmentId, items)
    }

    return groups
  }, [combinedPinned, filtered, hiddenDepartmentIds])

  const hiddenDepartments = useMemo(() => new Set(hiddenDepartmentIds), [hiddenDepartmentIds])

  const linesWithContent = useMemo(() => {
    return [...PRODUCT_LINE_REGISTRY]
      .sort((a, b) => a.order - b.order)
      .map((line) => ({
        line,
        sections: buildLineSections(line, grouped, hiddenDepartments, departmentOrderOverrides),
      }))
      .filter((x) => x.sections.length > 0)
  }, [departmentOrderOverrides, grouped, hiddenDepartments])

  const pinnedList = useMemo(() => apps.filter((app) => combinedPinned.has(app.moduleId)).slice(0, MAX_CHIPS), [apps, combinedPinned])

  const recentList = useMemo(() => {
    const byId = new Map(apps.map((app) => [app.moduleId, app]))
    return recentIds.map((id) => byId.get(id)).filter((item): item is LauncherAppItem => Boolean(item)).slice(0, MAX_CHIPS)
  }, [apps, recentIds])

  const toggleFavorite = (moduleId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(moduleId) ? prev.filter((x) => x !== moduleId) : [...prev, moduleId]
      setFavoriteIds(next)
      return next
    })
  }

  const hasSearch = deferredSearch.trim().length > 0
  const searchEmpty = hasSearch && filtered.length === 0

  const isLineOpen = (lineId: string) => hasSearch || !collapsedLines.has(lineId)
  const gridColumns = useGridColumns()
  const lineRows = useMemo(
    () => chunkArray(linesWithContent, gridColumns),
    [gridColumns, linesWithContent]
  )

  return (
    <div className="relative mx-auto max-w-7xl space-y-8 [font-family:'Noto_Sans_Thai','IBM_Plex_Sans_Thai',sans-serif]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 overflow-hidden rounded-[2.5rem] bg-[#e8e5f2]">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-orange-200/35 blur-3xl" />
        <div className="absolute left-1/3 top-0 h-full w-72 -skew-x-12 bg-white/25" />
      </div>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/35 px-5 py-6 shadow-xl shadow-slate-200/60 backdrop-blur md:px-8 md:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              {APP_BRAND.launcherBadge}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
              {APP_BRAND.name}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
              {APP_BRAND.tagline}
            </p>
          </div>

          <div className="w-full lg:max-w-md">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาโมดูล เช่น งานซ่อม, อะไหล่, ผู้ใช้..."
                className="h-14 w-full rounded-2xl border border-white/80 bg-white/85 pl-12 pr-4 text-sm text-slate-800 shadow-lg shadow-slate-200/50 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-200/35"
                aria-label="ค้นหาโมดูล"
              />
            </label>
          </div>
        </div>

        {(pinnedList.length > 0 || recentList.length > 0) && !searchEmpty && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <QuickAccess title="ปักหมุด" apps={pinnedList} tone="amber" />
            <QuickAccess title="ล่าสุด" apps={recentList} tone="slate" />
          </div>
        )}
      </section>

      {searchEmpty && (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center shadow-sm">
          <p className="font-semibold text-slate-700">ไม่พบโมดูลที่ตรงกับ “{deferredSearch.trim()}”</p>
          <p className="mt-1 text-sm text-slate-500">ลองค้นด้วยคำอื่น หรือเคลียร์ช่องค้นหาเพื่อดูทุกโมดูล</p>
        </div>
      )}

      {!searchEmpty && (
        <div className="space-y-5 pb-8">
          {lineRows.map((row, rowIndex) => {
            const openInRow = row.filter(({ line }) => isLineOpen(line.id))

            return (
              <div key={`line-row-${rowIndex}`} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {row.map(({ line, sections }) => (
                    <ProductLineCard
                      key={line.id}
                      line={line}
                      totalApps={sections.reduce((n, s) => n + s.apps.length, 0)}
                      isOpen={isLineOpen(line.id)}
                      onToggle={() => toggleLine(line.id)}
                    />
                  ))}
                </div>

                {openInRow.length > 0 && (
                  <div className="space-y-4">
                    {openInRow.map(({ line, sections }) => (
                      <ProductLineExpandedPanel
                        key={`${line.id}-panel`}
                        line={line}
                        sections={sections}
                        onClose={() => toggleLine(line.id)}
                        combinedPinned={combinedPinned}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!searchEmpty && linesWithContent.length === 0 && (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white/70 px-6 py-12 text-center text-sm text-slate-600">
          ไม่มีโมดูลที่แสดงได้ตามสิทธิ์หรือการตั้งค่าปัจจุบัน
        </div>
      )}
    </div>
  )
}

function ProductLineCard({
  line,
  totalApps,
  isOpen,
  onToggle,
}: {
  line: ProductLineDef
  totalApps: number
  isOpen: boolean
  onToggle: () => void
}) {
  const HeroIcon = LINE_HERO_ICONS[line.iconKey]
  const theme = lineTheme(line.id)

  return (
    <section
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/75 shadow-lg shadow-slate-200/50 backdrop-blur transition-all duration-300",
        theme.glow,
        isOpen && "ring-2",
        isOpen && theme.ring
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="group relative flex w-full flex-col items-center px-5 py-6 text-center transition hover:bg-white/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/50"
      >
        <span className={cn("pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl", theme.blob)} />

        <div className="relative mb-4">
          <div
            className={cn(
              "flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition group-hover:scale-[1.03] group-hover:shadow-xl",
              theme.icon
            )}
          >
            <HeroIcon className="h-8 w-8" strokeWidth={1.75} />
          </div>
          <span className="absolute -bottom-1.5 -right-1.5 rounded-full border border-white bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm">
            {totalApps}
          </span>
        </div>

        <div className="w-full min-w-0">
          <h2 className="text-lg font-black leading-tight text-slate-950">{line.labelTh}</h2>
          <p className="mt-1.5 line-clamp-2 px-1 text-sm leading-relaxed text-slate-500">{line.description}</p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-slate-100/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {totalApps} โมดูล
          </span>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <span className="hidden sm:inline">{isOpen ? "ซ่อนโมดูล" : "ดูโมดูล"}</span>
          <ChevronDown className={cn("h-5 w-5 transition-transform duration-200", isOpen && "rotate-180")} />
        </div>
      </button>
    </section>
  )
}

function ProductLineExpandedPanel({
  line,
  sections,
  onClose,
  combinedPinned,
  onToggleFavorite,
}: {
  line: ProductLineDef
  sections: { departmentId: string; label: string; apps: LauncherAppItem[] }[]
  onClose: () => void
  combinedPinned: Set<string>
  onToggleFavorite: (moduleId: string) => void
}) {
  const HeroIcon = LINE_HERO_ICONS[line.iconKey]
  const theme = lineTheme(line.id)

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[1.75rem] border bg-white/85 shadow-lg shadow-slate-200/50 backdrop-blur ring-2",
        theme.ring
      )}
    >
      <button
        type="button"
        onClick={onClose}
        className="flex w-full items-center gap-4 border-b border-slate-100/80 bg-white/50 px-5 py-4 text-left transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/50 sm:px-6"
      >
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", theme.icon)}>
          <HeroIcon className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-base font-black text-slate-950">{line.labelTh}</h3>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{line.labelEn}</span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{line.description}</p>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 rotate-180 text-slate-400" />
      </button>

      <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        {sections.map(({ departmentId, label, apps: sectionApps }) => (
          <div key={departmentId}>
            {sections.length > 1 && (
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200/80" />
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                <div className="h-px flex-1 bg-slate-200/80" />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
              {sectionApps.map((app) => (
                <AppTile
                  key={app.moduleId}
                  app={app}
                  isPinned={combinedPinned.has(app.moduleId)}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function QuickAccess({
  title,
  apps,
  tone,
}: {
  title: string
  apps: LauncherAppItem[]
  tone: "amber" | "slate"
}) {
  if (apps.length === 0) return null
  return (
    <div className="rounded-2xl border border-white/70 bg-white/55 p-3 shadow-sm">
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-2">
        {apps.map((app) => (
          <Link
            key={`${title}-${app.moduleId}`}
            href={app.href}
            onClick={() => pushRecent(app.moduleId)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              tone === "amber"
                ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            {app.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function AppTile({
  app,
  isPinned,
  onToggleFavorite,
}: {
  app: LauncherAppItem
  isPinned: boolean
  onToggleFavorite: (moduleId: string) => void
}) {
  const Icon = APP_ICON_MAP[app.icon] ?? LayoutDashboard
  const skin = skinFor(app.moduleId)

  return (
    <div className="group relative flex flex-col items-center text-center">
      <button
        type="button"
        onClick={() => onToggleFavorite(app.moduleId)}
        className={cn(
          "absolute right-0 top-0 z-10 rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-slate-200/80 transition sm:opacity-0 sm:group-hover:opacity-100",
          isPinned ? "text-amber-500 sm:opacity-100" : "text-slate-300 hover:text-amber-500"
        )}
        title={isPinned ? "เอาออกจากปักหมุด" : "ปักหมุด"}
        aria-pressed={isPinned}
      >
        <Star className={cn("h-3.5 w-3.5", isPinned && "fill-amber-400")} />
      </button>

      <Link
        href={app.href}
        onClick={() => pushRecent(app.moduleId)}
        className="flex w-full flex-col items-center rounded-2xl border border-transparent p-2 outline-none transition hover:-translate-y-0.5 hover:border-slate-200/60 hover:bg-white/60 hover:shadow-md focus-visible:ring-4 focus-visible:ring-cyan-200/60"
      >
        <span
          className={cn(
            "relative mb-2.5 flex h-[4.25rem] w-[4.25rem] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br shadow-md ring-1 transition group-hover:shadow-lg",
            skin.tile
          )}
        >
          <span className={cn("absolute -right-3 -top-3 h-10 w-10 rounded-full blur-sm", skin.blob)} />
          <span className={cn("absolute -bottom-4 left-1 h-12 w-12 rotate-12 rounded-2xl blur-[1px]", skin.blob)} />
          <span className={cn("relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm", skin.icon)}>
            <Icon className="h-5 w-5" strokeWidth={2.1} />
          </span>
        </span>
        <span className="min-h-[2.5rem] w-full px-0.5 text-[12px] font-semibold leading-snug text-slate-800 sm:text-[13px]">
          {app.label}
        </span>
      </Link>
    </div>
  )
}
