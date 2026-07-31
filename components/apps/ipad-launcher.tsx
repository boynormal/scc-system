"use client"

import Link from "next/link"
import Image from "next/image"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { LayoutGrid, Search, Star, X, type LucideIcon } from "lucide-react"
import type { LauncherAppItem } from "@/shared/navigation/flattenNav"
import type { NavIconKey } from "@/shared/navigation/moduleRegistry"
import { DEPARTMENT_BY_ID } from "@/shared/navigation/departmentRegistry"
import { PRODUCT_LINE_REGISTRY, type ProductLineDef } from "@/shared/navigation/productLineRegistry"
import { isExternalHref } from "@/shared/navigation/isExternalHref"
import {
  getFavoriteIds,
  getRecentIds,
  LAUNCHER_DOCK_MAX,
  recordAppOpen,
  setFavoriteIds,
  skinFor,
} from "@/shared/navigation/launcherClientState"
import { NAV_ICON_MAP } from "@/components/layout/nav-icon-map"
import { APP_BRAND } from "@/shared/branding"
import { CompanyBrandMark } from "@/components/brand/company-brand-mark"
import type { AppAppearance } from "@/shared/navigation/companyNavPreferences"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { LauncherClockWeather, type WeatherBranchOption } from "@/components/apps/launcher-clock-weather"

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

const DOCK_MAX = LAUNCHER_DOCK_MAX

/** Build ordered dock ids: company pins first, then user favorites. */
function buildDockOrderedIds(
  companyPinnedIds: string[],
  favoriteIds: string[],
  availableIds: Set<string>
): string[] {
  const seen = new Set<string>()
  const ids: string[] = []

  for (const id of companyPinnedIds) {
    if (ids.length >= DOCK_MAX) break
    if (!availableIds.has(id) || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  for (const id of favoriteIds) {
    if (ids.length >= DOCK_MAX) break
    if (!availableIds.has(id) || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export function IpadLauncher({
  apps,
  pinnedModuleIds,
  hiddenDepartmentIds,
  departmentOrderOverrides,
  productLineIconOverrides = {},
  productLineImageOverrides = {},
  moduleImageOverrides = {},
  appearance = "light",
  weatherBranches = [],
  logoUrl,
}: {
  apps: LauncherAppItem[]
  pinnedModuleIds: string[]
  hiddenDepartmentIds: string[]
  departmentOrderOverrides: Record<string, number>
  productLineIconOverrides?: Record<string, NavIconKey>
  productLineImageOverrides?: Record<string, string>
  moduleImageOverrides?: Record<string, string>
  appearance?: AppAppearance
  weatherBranches?: WeatherBranchOption[]
  logoUrl?: string | null
}) {
  const isDark = appearance === "dark"
  const t = useTranslations("apps")
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [favorites, setFavorites] = useState<string[]>([])
  const [lastRecentId, setLastRecentId] = useState<string | null>(null)
  const [dockNotice, setDockNotice] = useState<string | null>(null)
  const [openLineId, setOpenLineId] = useState<string | null>(null)

  useEffect(() => {
    setFavorites(getFavoriteIds())
    setLastRecentId(getRecentIds()[0] ?? null)
  }, [])

  useEffect(() => {
    if (!dockNotice) return
    const timer = window.setTimeout(() => setDockNotice(null), 3200)
    return () => window.clearTimeout(timer)
  }, [dockNotice])

  const availableIds = useMemo(() => new Set(apps.map((a) => a.moduleId)), [apps])
  const appsById = useMemo(() => new Map(apps.map((a) => [a.moduleId, a])), [apps])

  const combinedPinned = useMemo(
    () => new Set<string>([...pinnedModuleIds, ...favorites]),
    [favorites, pinnedModuleIds]
  )

  const toggleFavorite = (moduleId: string) => {
    setFavorites((prev) => {
      if (prev.includes(moduleId)) {
        const next = prev.filter((x) => x !== moduleId)
        setFavoriteIds(next)
        return next
      }

      const currentDock = buildDockOrderedIds(pinnedModuleIds, prev, availableIds)
      if (!currentDock.includes(moduleId) && currentDock.length >= DOCK_MAX) {
        setDockNotice(t("dockFull"))
        return prev
      }

      const next = [...prev, moduleId]
      setFavoriteIds(next)
      return next
    })
  }

  const markOpen = (moduleId: string) => {
    recordAppOpen(moduleId)
    setLastRecentId(moduleId)
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

  /** Dock: company pins then user favorites only (stable order, no usage fill). */
  const dockApps = useMemo(() => {
    const ids = buildDockOrderedIds(pinnedModuleIds, favorites, availableIds)
    return ids
      .map((id) => appsById.get(id))
      .filter((item): item is LauncherAppItem => Boolean(item))
  }, [appsById, availableIds, favorites, pinnedModuleIds])

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

      <div className="relative z-10 mx-auto h-full max-w-6xl overflow-y-auto px-4 pb-40 pt-6 sm:px-8 sm:pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CompanyBrandMark logoUrl={logoUrl} size="md" alt={APP_BRAND.name} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground dark:text-white/55">{APP_BRAND.launcherBadge}</p>
              <h1 className="text-2xl font-black text-foreground drop-shadow-sm sm:text-3xl dark:text-white">{APP_BRAND.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative block w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-white/70" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-11 w-full rounded-full border border-white/70 bg-white/80 pl-10 pr-4 text-sm text-foreground shadow-sm outline-none backdrop-blur-md transition placeholder:text-muted-foreground focus:border-white focus:bg-white focus:ring-4 focus:ring-white/20 dark:border-white/20 dark:bg-slate-950/30 dark:text-white dark:placeholder:text-white/55 dark:focus:border-white/40 dark:focus:bg-slate-950/45"
                aria-label={t("searchPlaceholder")}
              />
            </label>
            <Link
              href="/app2"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-3.5 py-2.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-md transition hover:bg-white dark:border-white/20 dark:bg-slate-950/30 dark:text-white dark:hover:bg-slate-950/45"
              title="มุมมองการ์ด"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">มุมมองการ์ด</span>
            </Link>
          </div>
        </div>

        <LauncherClockWeather className="mt-5" branches={weatherBranches} />

        {isSearching ? (
          <div className="mt-10">
            {searchResults.length === 0 ? (
              <div className="rounded-[1.75rem] border border-white/60 bg-white/50 px-6 py-14 text-center text-foreground backdrop-blur-md dark:border-white/20 dark:bg-white/10 dark:text-white/80">
                <p className="font-semibold">{t("noResults")}</p>
                <p className="mt-1 text-sm text-muted-foreground dark:text-white/60">{t("noResultsHint")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {searchResults.map((app) => (
                  <IosIcon
                    key={app.moduleId}
                    app={app}
                    isPinned={combinedPinned.has(app.moduleId)}
                    onToggleFavorite={toggleFavorite}
                    onOpen={() => markOpen(app.moduleId)}
                    dark={!isDark}
                    imageUrl={moduleImageOverrides[app.moduleId]}
                    pinLabel={t("pin")}
                    unpinLabel={t("unpin")}
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
          <div className="mt-10 rounded-[1.75rem] border border-white/60 bg-white/50 px-6 py-12 text-center text-sm text-foreground backdrop-blur-md dark:border-white/20 dark:bg-white/10 dark:text-white/80">
            ไม่มีโมดูลที่แสดงได้ตามสิทธิ์หรือการตั้งค่าปัจจุบัน
          </div>
        )}
      </div>

      {dockNotice && (
        <div className="absolute inset-x-0 bottom-[5.75rem] z-40 flex justify-center px-4 sm:bottom-[6.5rem]">
          <p
            role="status"
            className="rounded-full border border-amber-200/80 bg-amber-50/95 px-4 py-2 text-center text-xs font-medium text-amber-900 shadow-lg backdrop-blur-md dark:border-amber-500/30 dark:bg-amber-950/90 dark:text-amber-100"
          >
            {dockNotice}
          </p>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-3 z-30 flex justify-center px-3 sm:bottom-4 sm:px-4">
        <div
          className="flex min-h-[4.75rem] max-w-[96vw] items-end gap-2 overflow-x-auto rounded-[2rem] border border-white/40 bg-white/25 px-3 py-2.5 shadow-xl shadow-black/10 backdrop-blur-2xl sm:min-h-[5.25rem] sm:gap-3 sm:px-4 sm:py-3 dark:border-white/15 dark:bg-slate-950/30"
          role="toolbar"
          aria-label={t("dockEmpty")}
        >
          {dockApps.length === 0 ? (
            <p className="px-3 py-2 text-center text-xs font-medium text-muted-foreground sm:text-sm dark:text-white/65">
              {t("dockEmpty")}
            </p>
          ) : (
            dockApps.map((app) => (
              <DockIcon
                key={app.moduleId}
                app={app}
                emphasized={app.moduleId === lastRecentId}
                onOpen={() => markOpen(app.moduleId)}
                imageUrl={moduleImageOverrides[app.moduleId]}
              />
            ))
          )}
        </div>
      </div>

      {openLine && (
        <FolderOverlay
          line={openLine.line}
          sections={openLine.sections}
          combinedPinned={combinedPinned}
          onToggleFavorite={toggleFavorite}
          onOpenApp={markOpen}
          iconOverrides={productLineIconOverrides}
          imageOverrides={productLineImageOverrides}
          moduleImageOverrides={moduleImageOverrides}
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
          "relative flex aspect-square w-[4.75rem] items-center justify-center rounded-[1.4rem] bg-gradient-to-br text-white shadow-lg ring-1 ring-black/10 transition group-hover:scale-[1.05] group-hover:shadow-xl sm:w-20 dark:ring-white/20",
          line.accent
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            width={80}
            height={80}
            className="h-full w-full rounded-[1.4rem] object-cover"
            unoptimized
          />
        ) : (
          <Icon className="h-8 w-8 text-white sm:h-9 sm:w-9" strokeWidth={1.9} />
        )}
        <span className="absolute -bottom-1.5 -right-1.5 rounded-full border border-border bg-card px-1.5 py-0.5 text-[9px] font-bold text-foreground shadow-sm">
          {totalApps}
        </span>
      </span>
      <span className="max-w-[5.5rem] text-[12px] font-semibold leading-snug text-foreground drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)] sm:max-w-[6rem] sm:text-[13px] dark:text-white dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
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
  onOpenApp,
  iconOverrides,
  imageOverrides,
  moduleImageOverrides,
  onClose,
}: {
  line: ProductLineDef
  sections: LineSection[]
  combinedPinned: Set<string>
  onToggleFavorite: (moduleId: string) => void
  onOpenApp: (moduleId: string) => void
  iconOverrides: Record<string, NavIconKey>
  imageOverrides: Record<string, string>
  moduleImageOverrides: Record<string, string>
  onClose: () => void
}) {
  const t = useTranslations("apps")
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
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-white/95 px-5 py-4 backdrop-blur sm:px-7 dark:border-slate-700 dark:bg-slate-900/95">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", line.accent)}>
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt=""
                width={44}
                height={44}
                className="h-full w-full rounded-xl object-cover"
                unoptimized
              />
            ) : (
              <HeroIcon className="h-5 w-5" strokeWidth={1.9} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-950">{line.labelTh}</h2>
            <p className="line-clamp-1 text-xs text-muted-foreground dark:text-muted-foreground">{line.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
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
                      onOpenApp(app.moduleId)
                      onClose()
                    }}
                    dark
                    imageUrl={moduleImageOverrides[app.moduleId]}
                    pinLabel={t("pin")}
                    unpinLabel={t("unpin")}
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
  imageUrl,
  pinLabel,
  unpinLabel,
}: {
  app: LauncherAppItem
  isPinned: boolean
  onToggleFavorite: (moduleId: string) => void
  onOpen: () => void
  dark?: boolean
  imageUrl?: string
  pinLabel: string
  unpinLabel: string
}) {
  const Icon: LucideIcon = NAV_ICON_MAP[app.icon] ?? LayoutGrid
  const skin = skinFor(app.moduleId)
  const external = isExternalHref(app.href)

  const iconTile = (
    <span
      className={cn(
        "relative flex aspect-square w-[4.25rem] items-center justify-center overflow-hidden rounded-[1.25rem] bg-gradient-to-br shadow-md ring-1 ring-black/10 transition group-hover:scale-[1.05] group-hover:shadow-lg sm:w-[4.5rem] dark:ring-white/15",
        skin.tile
      )}
    >
      {imageUrl ? (
        <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/10 sm:h-11 sm:w-11">
          <Image
            src={imageUrl}
            alt=""
            width={44}
            height={44}
            className="h-full w-full object-contain p-1"
            unoptimized
          />
        </span>
      ) : (
        <span className={cn("relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ring-1 ring-black/10", skin.icon)}>
          <Icon className="h-5 w-5 text-white" strokeWidth={2.1} />
        </span>
      )}
    </span>
  )

  const labelClass = dark
    ? "max-w-[5.5rem] text-[11.5px] font-semibold leading-snug text-foreground"
    : "max-w-[5.5rem] text-[12px] font-semibold leading-snug text-foreground drop-shadow-sm dark:text-white"

  const wrapperClass = "flex flex-col items-center gap-2 text-center outline-none"

  return (
    <div className="group relative flex flex-col items-center">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleFavorite(app.moduleId)
        }}
        className={cn(
          "absolute -right-1 -top-1 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-md transition",
          isPinned
            ? "border-amber-400 bg-amber-100 text-amber-600 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-300"
            : "border-border bg-card text-muted-foreground hover:border-amber-400 hover:text-amber-500 dark:hover:text-amber-300"
        )}
        title={isPinned ? unpinLabel : pinLabel}
        aria-label={isPinned ? unpinLabel : pinLabel}
        aria-pressed={isPinned}
      >
        <Star className={cn("h-3.5 w-3.5", isPinned && "fill-amber-400")} />
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

function DockIcon({
  app,
  onOpen,
  imageUrl,
  emphasized = false,
}: {
  app: LauncherAppItem
  onOpen: () => void
  imageUrl?: string
  emphasized?: boolean
}) {
  const Icon: LucideIcon = NAV_ICON_MAP[app.icon] ?? LayoutGrid
  const skin = skinFor(app.moduleId)
  const external = isExternalHref(app.href)

  const content = (
    <>
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br shadow-md ring-1 ring-black/10 transition hover:scale-105 sm:h-12 sm:w-12 dark:ring-white/15",
          emphasized
            ? "from-rose-500 to-pink-600 text-white shadow-rose-600/40 ring-rose-700/50 scale-105"
            : skin.tile
        )}
      >
        {imageUrl ? (
          <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/10 sm:h-9 sm:w-9">
            <Image
              src={imageUrl}
              alt=""
              width={36}
              height={36}
              className="h-full w-full object-contain p-0.5"
              unoptimized
            />
          </span>
        ) : (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ring-1 ring-black/10",
              emphasized ? "from-rose-600 to-pink-500 text-white" : skin.icon
            )}
          >
            <Icon className="h-4 w-4 text-white" strokeWidth={2.1} />
          </span>
        )}
      </span>
      <span
        className={cn(
          "line-clamp-1 w-full max-w-[4.5rem] truncate text-center text-[10px] font-semibold leading-snug sm:max-w-[5rem] sm:text-[11px]",
          emphasized ? "text-rose-700 dark:text-rose-300" : "text-foreground dark:text-white"
        )}
      >
        {app.label}
      </span>
    </>
  )

  const wrapperClass = cn(
    "flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-xl px-0.5 py-0.5 text-center outline-none transition hover:bg-white/40 dark:hover:bg-white/10 sm:w-[5rem]",
    emphasized && "bg-rose-500/10 dark:bg-rose-400/10"
  )

  if (external) {
    return (
      <a
        href={app.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
        className={wrapperClass}
        title={app.label}
        aria-current={emphasized ? "true" : undefined}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      href={app.href}
      onClick={onOpen}
      className={wrapperClass}
      title={app.label}
      aria-current={emphasized ? "true" : undefined}
    >
      {content}
    </Link>
  )
}
