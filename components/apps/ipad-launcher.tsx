"use client"

import Link from "next/link"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { LayoutGrid, Search, Star, X, type LucideIcon } from "lucide-react"
import type { LauncherAppItem } from "@/shared/navigation/flattenNav"
import type { NavIconKey } from "@/shared/navigation/moduleRegistry"
import { DEPARTMENT_BY_ID } from "@/shared/navigation/departmentRegistry"
import { PRODUCT_LINE_REGISTRY, type ProductLineDef } from "@/shared/navigation/productLineRegistry"
import { isExternalHref } from "@/shared/navigation/isExternalHref"
import {
  getFavoriteIds,
  getUsageCounts,
  recordAppOpen,
  setFavoriteIds,
  skinFor,
} from "@/shared/navigation/launcherClientState"
import { NAV_ICON_MAP } from "@/components/layout/nav-icon-map"
import { APP_BRAND } from "@/shared/branding"
import type { AppAppearance } from "@/shared/navigation/companyNavPreferences"
import { cn } from "@/lib/utils"

type LineSection = { departmentId: string; label: string; apps: LauncherAppItem[] }
type LineGroup = { line: ProductLineDef; sections: LineSection[] }

function resolveLineIcon(line: ProductLineDef, overrides: Record<string, NavIconKey>) {
  const key = overrides[line.id] ?? line.iconKey
  return NAV_ICON_MAP[key] ?? NAV_ICON_MAP[line.iconKey]
}

function buildLineSections(
  line: ProductLineDef,
  grouped: Map<string, LauncherAppItem[]>,
  hiddenDepartments: Set<string>,
  departmentOrderOverrides: Record<string, number>
): LineSection[] {
  const seen = new Set<string>()
  const sections: LineSection[] = []

  for (const deptId of line.departmentIds) {
    if (hiddenDepartments.has(deptId)) continue
    const raw = grouped.get(deptId) ?? []
    const apps = raw.filter((app) => {
      if (seen.has(app.moduleId)) return false
      seen.add(app.moduleId)
      return true
    })
    if (apps.length === 0) continue
    sections.push({ departmentId: deptId, label: DEPARTMENT_BY_ID[deptId]?.label ?? deptId, apps })
  }

  sections.sort((a, b) => {
    const ao = departmentOrderOverrides[a.departmentId] ?? DEPARTMENT_BY_ID[a.departmentId]?.order ?? 999
    const bo = departmentOrderOverrides[b.departmentId] ?? DEPARTMENT_BY_ID[b.departmentId]?.order ?? 999
    if (ao !== bo) return ao - bo
    return a.label.localeCompare(b.label)
  })
  return sections
}

const DOCK_MAX = 8

export function IpadLauncher({
  apps,
  pinnedModuleIds,
  hiddenDepartmentIds,
  departmentOrderOverrides,
  productLineIconOverrides = {},
  productLineImageOverrides = {},
  appearance = "light",
}: {
  apps: LauncherAppItem[]
  pinnedModuleIds: string[]
  hiddenDepartmentIds: string[]
  departmentOrderOverrides: Record<string, number>
  productLineIconOverrides?: Record<string, NavIconKey>
  productLineImageOverrides?: Record<string, string>
  appearance?: AppAppearance
}) {
  const isDark = appearance === "dark"
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [favorites, setFavorites] = useState<string[]>([])
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
  const [openLineId, setOpenLineId] = useState<string | null>(null)

  useEffect(() => {
    setFavorites(getFavoriteIds())
    setUsageCounts(getUsageCounts())
  }, [])

  const combinedPinned = useMemo(() => new Set<string>([...pinnedModuleIds, ...favorites]), [favorites, pinnedModuleIds])

  const toggleFavorite = (moduleId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(moduleId) ? prev.filter((x) => x !== moduleId) : [...prev, moduleId]
      setFavoriteIds(next)
      return next
    })
  }

  const hiddenDepartments = useMemo(() => new Set(hiddenDepartmentIds), [hiddenDepartmentIds])

  const grouped = useMemo(() => {
    const groups = new Map<string, LauncherAppItem[]>()
    for (const app of apps) {
      if (hiddenDepartments.has(app.departmentId)) continue
      const items = groups.get(app.departmentId) ?? []
      items.push(app)
      groups.set(app.departmentId, items)
    }
    for (const items of groups.values()) {
      items.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    }
    return groups
  }, [apps, hiddenDepartments])

  const lines = useMemo<LineGroup[]>(() => {
    return [...PRODUCT_LINE_REGISTRY]
      .sort((a, b) => a.order - b.order)
      .map((line) => {
        const sections = buildLineSections(line, grouped, hiddenDepartments, departmentOrderOverrides)
        return { line, sections }
      })
      .filter((x) => x.sections.length > 0)
  }, [departmentOrderOverrides, grouped, hiddenDepartments])

  const deferredQuery = deferredSearch.trim().toLowerCase()
  const isSearching = deferredQuery.length > 0
  const searchResults = useMemo(() => {
    if (!isSearching) return []
    return apps
      .filter((app) => !hiddenDepartments.has(app.departmentId) && app.searchText.includes(deferredQuery))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  }, [apps, deferredQuery, hiddenDepartments, isSearching])

  /**
   * Dock: ปักหมุด/รายการโปรดมาก่อนเสมอ — ถ้ายังไม่ครบ DOCK_MAX ให้เติมด้วยโมดูลที่ถูกเปิดบ่อยที่สุด
   * (นับจาก usageCounts) ที่ยังไม่ถูกปักหมุดและไม่อยู่ในแผนกที่ถูกซ่อน
   */
  const dockApps = useMemo(() => {
    const pinnedList = apps.filter((app) => combinedPinned.has(app.moduleId)).slice(0, DOCK_MAX)
    const remainingSlots = DOCK_MAX - pinnedList.length
    if (remainingSlots <= 0) return pinnedList

    const frequentFill = apps
      .filter(
        (app) =>
          !combinedPinned.has(app.moduleId) &&
          !hiddenDepartments.has(app.departmentId) &&
          (usageCounts[app.moduleId] ?? 0) > 0
      )
      .sort((a, b) => (usageCounts[b.moduleId] ?? 0) - (usageCounts[a.moduleId] ?? 0))
      .slice(0, remainingSlots)

    return [...pinnedList, ...frequentFill]
  }, [apps, combinedPinned, hiddenDepartments, usageCounts])

  const openLine = lines.find((x) => x.line.id === openLineId) ?? null

  return (
    <div
      className={cn(
        "relative h-full min-h-[32rem] overflow-hidden bg-gradient-to-br [font-family:'Noto_Sans_Thai','IBM_Plex_Sans_Thai',sans-serif]",
        isDark
          ? "from-[#050816] via-[#111b45] to-[#34235d]"
          : "from-[#dff4ff] via-[#e8e7ff] to-[#fce7f3]",
        isDark && "dark"
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(14,165,233,0.24),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(244,114,182,0.22),transparent_28%),radial-gradient(circle_at_52%_92%,rgba(139,92,246,0.20),transparent_35%)] dark:bg-[radial-gradient(circle_at_14%_12%,rgba(59,130,246,0.28),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(192,132,252,0.22),transparent_30%),radial-gradient(circle_at_52%_92%,rgba(236,72,153,0.14),transparent_35%)]" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-cyan-300/20 blur-3xl dark:bg-blue-500/15" />
      <div className="pointer-events-none absolute -right-24 top-4 h-[28rem] w-[28rem] rounded-full bg-rose-300/20 blur-3xl dark:bg-violet-500/15" />
      <div className="pointer-events-none absolute bottom-[-10rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-violet-300/15 blur-3xl dark:bg-fuchsia-500/10" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(100,116,139,0.12)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(2,6,23,0.35)_100%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-40 pt-6 sm:px-8 sm:pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-white/55">{APP_BRAND.launcherBadge}</p>
            <h1 className="text-2xl font-black text-slate-900 drop-shadow-sm sm:text-3xl dark:text-white">{APP_BRAND.name}</h1>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative block w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-white/70" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาโมดูล..."
                className="h-11 w-full rounded-full border border-white/70 bg-white/80 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none backdrop-blur-md transition placeholder:text-slate-400 focus:border-white focus:bg-white focus:ring-4 focus:ring-white/20 dark:border-white/20 dark:bg-slate-950/30 dark:text-white dark:placeholder:text-white/55 dark:focus:border-white/40 dark:focus:bg-slate-950/45"
                aria-label="ค้นหาโมดูล"
              />
            </label>
            <Link
              href="/app2"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-md transition hover:bg-white dark:border-white/20 dark:bg-slate-950/30 dark:text-white dark:hover:bg-slate-950/45"
              title="มุมมองการ์ด"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">มุมมองการ์ด</span>
            </Link>
          </div>
        </div>

        {isSearching ? (
          <div className="mt-10">
            {searchResults.length === 0 ? (
              <div className="rounded-[1.75rem] border border-white/60 bg-white/50 px-6 py-14 text-center text-slate-700 backdrop-blur-md dark:border-white/20 dark:bg-white/10 dark:text-white/80">
                <p className="font-semibold">ไม่พบโมดูลที่ตรงกับ “{deferredSearch.trim()}”</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-white/60">ลองค้นด้วยคำอื่น หรือเคลียร์ช่องค้นหา</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {searchResults.map((app) => (
                  <IosIcon
                    key={app.moduleId}
                    app={app}
                    isPinned={combinedPinned.has(app.moduleId)}
                    onToggleFavorite={toggleFavorite}
                    onOpen={() => recordAppOpen(app.moduleId)}
                    dark={!isDark}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-3 gap-x-4 gap-y-10 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {lines.map(({ line, sections }) => (
              <FolderIcon
                key={line.id}
                line={line}
                iconOverrides={productLineIconOverrides}
                imageOverrides={productLineImageOverrides}
                totalApps={sections.reduce((n, s) => n + s.apps.length, 0)}
                onOpen={() => setOpenLineId(line.id)}
              />
            ))}
          </div>
        )}

        {!isSearching && lines.length === 0 && (
          <div className="mt-10 rounded-[1.75rem] border border-white/60 bg-white/50 px-6 py-12 text-center text-sm text-slate-700 backdrop-blur-md dark:border-white/20 dark:bg-white/10 dark:text-white/80">
            ไม่มีโมดูลที่แสดงได้ตามสิทธิ์หรือการตั้งค่าปัจจุบัน
          </div>
        )}
      </div>

      {dockApps.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="flex max-w-[96vw] items-end gap-2 overflow-x-auto rounded-[2rem] border border-white/70 bg-white/75 px-3 py-2.5 shadow-2xl backdrop-blur-2xl sm:gap-3 sm:px-4 sm:py-3 dark:border-white/20 dark:bg-slate-950/40">
            {dockApps.map((app) => (
              <DockIcon key={app.moduleId} app={app} onOpen={() => recordAppOpen(app.moduleId)} />
            ))}
          </div>
        </div>
      )}

      {openLine && (
        <FolderOverlay
          line={openLine.line}
          sections={openLine.sections}
          combinedPinned={combinedPinned}
          onToggleFavorite={toggleFavorite}
          iconOverrides={productLineIconOverrides}
          imageOverrides={productLineImageOverrides}
          onClose={() => setOpenLineId(null)}
        />
      )}
    </div>
  )
}

function FolderIcon({
  line,
  iconOverrides,
  imageOverrides,
  totalApps,
  onOpen,
}: {
  line: ProductLineDef
  iconOverrides: Record<string, NavIconKey>
  imageOverrides: Record<string, string>
  totalApps: number
  onOpen: () => void
}) {
  const Icon = resolveLineIcon(line, iconOverrides)
  const imageUrl = imageOverrides[line.id]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col items-center gap-2.5 text-center outline-none"
      aria-label={`เปิดกลุ่ม ${line.labelTh}`}
    >
      <span
        className={cn(
          "relative flex aspect-square w-[4.75rem] items-center justify-center rounded-[1.4rem] bg-gradient-to-br shadow-lg ring-1 ring-white/25 transition group-hover:scale-[1.05] group-hover:shadow-xl sm:w-20",
          line.accent
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full rounded-[1.4rem] object-cover" />
        ) : (
          <Icon className="h-8 w-8 text-white sm:h-9 sm:w-9" strokeWidth={1.9} />
        )}
        <span className="absolute -bottom-1.5 -right-1.5 rounded-full border border-white/70 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shadow-sm">
          {totalApps}
        </span>
      </span>
      <span className="max-w-[5.5rem] text-[12px] font-semibold leading-snug text-slate-800 drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)] sm:max-w-[6rem] sm:text-[13px] dark:text-white dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
        {line.labelTh}
      </span>
    </button>
  )
}

function FolderOverlay({
  line,
  sections,
  combinedPinned,
  onToggleFavorite,
  iconOverrides,
  imageOverrides,
  onClose,
}: {
  line: ProductLineDef
  sections: LineSection[]
  combinedPinned: Set<string>
  onToggleFavorite: (moduleId: string) => void
  iconOverrides: Record<string, NavIconKey>
  imageOverrides: Record<string, string>
  onClose: () => void
}) {
  const HeroIcon = resolveLineIcon(line, iconOverrides)
  const imageUrl = imageOverrides[line.id]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={line.labelTh}
      onMouseDown={onClose}
    >
      <div
        className="max-h-[82vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-slate-900/95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7 dark:border-slate-700 dark:bg-slate-900/95">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", line.accent)}>
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full rounded-xl object-cover" />
            ) : (
              <HeroIcon className="h-5 w-5" strokeWidth={1.9} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-950 dark:text-slate-100">{line.labelTh}</h2>
            <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{line.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-6 sm:px-7">
          {sections.map(({ departmentId, label, apps: sectionApps }) => (
            <div key={departmentId}>
              {sections.length > 1 && (
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200/80 dark:bg-slate-700" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                  <div className="h-px flex-1 bg-slate-200/80 dark:bg-slate-700" />
                </div>
              )}
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                {sectionApps.map((app) => (
                  <IosIcon
                    key={app.moduleId}
                    app={app}
                    isPinned={combinedPinned.has(app.moduleId)}
                    onToggleFavorite={onToggleFavorite}
                    onOpen={() => {
                      recordAppOpen(app.moduleId)
                      onClose()
                    }}
                    dark
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function IosIcon({
  app,
  isPinned,
  onToggleFavorite,
  onOpen,
  dark = false,
}: {
  app: LauncherAppItem
  isPinned: boolean
  onToggleFavorite: (moduleId: string) => void
  onOpen: () => void
  dark?: boolean
}) {
  const Icon: LucideIcon = NAV_ICON_MAP[app.icon] ?? LayoutGrid
  const skin = skinFor(app.moduleId)
  const external = isExternalHref(app.href)

  const iconTile = (
    <span
      className={cn(
        "relative flex aspect-square w-[4.25rem] items-center justify-center rounded-[1.25rem] bg-gradient-to-br shadow-md ring-1 transition group-hover:scale-[1.05] group-hover:shadow-lg sm:w-[4.5rem]",
        skin.tile
      )}
    >
      <span className={cn("relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm", skin.icon)}>
        <Icon className="h-5 w-5" strokeWidth={2.1} />
      </span>
    </span>
  )

  const labelClass = dark
    ? "max-w-[5.5rem] text-[11.5px] font-semibold leading-snug text-slate-700 dark:text-slate-200"
    : "max-w-[5.5rem] text-[12px] font-semibold leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"

  const wrapperClass = "group relative flex flex-col items-center gap-2 text-center outline-none"

  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        onClick={() => onToggleFavorite(app.moduleId)}
        className={cn(
          "absolute right-2 top-0 z-10 rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-slate-200/80 transition sm:opacity-0 sm:group-hover:opacity-100",
          isPinned ? "text-amber-500 sm:opacity-100" : "text-slate-300 hover:text-amber-500"
        )}
        title={isPinned ? "เอาออกจากปักหมุด" : "ปักหมุด"}
        aria-pressed={isPinned}
      >
        <Star className={cn("h-3 w-3", isPinned && "fill-amber-400")} />
      </button>

      {external ? (
        <a href={app.href} target="_blank" rel="noopener noreferrer" onClick={onOpen} className={wrapperClass}>
          {iconTile}
          <span className={labelClass}>{app.label}</span>
        </a>
      ) : (
        <Link href={app.href} onClick={onOpen} className={wrapperClass}>
          {iconTile}
          <span className={labelClass}>{app.label}</span>
        </Link>
      )}
    </div>
  )
}

function DockIcon({ app, onOpen }: { app: LauncherAppItem; onOpen: () => void }) {
  const Icon: LucideIcon = NAV_ICON_MAP[app.icon] ?? LayoutGrid
  const skin = skinFor(app.moduleId)
  const external = isExternalHref(app.href)

  const content = (
    <>
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md ring-1 transition hover:scale-105 sm:h-12 sm:w-12",
          skin.tile
        )}
      >
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm", skin.icon)}>
          <Icon className="h-4 w-4" strokeWidth={2.1} />
        </span>
      </span>
      <span className="line-clamp-2 max-w-[4.5rem] text-center text-[10px] font-semibold leading-snug text-slate-800 sm:max-w-[5rem] sm:text-[11px] dark:text-slate-100">
        {app.label}
      </span>
    </>
  )

  const wrapperClass =
    "flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-xl px-0.5 py-0.5 text-center outline-none transition hover:bg-white/40 dark:hover:bg-white/10 sm:w-[5rem]"

  if (external) {
    return (
      <a
        href={app.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
        className={wrapperClass}
        title={app.label}
      >
        {content}
      </a>
    )
  }

  return (
    <Link href={app.href} onClick={onOpen} className={wrapperClass} title={app.label}>
      {content}
    </Link>
  )
}
