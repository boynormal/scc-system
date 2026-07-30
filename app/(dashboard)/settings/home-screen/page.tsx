"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Check,
  Layers,
  Loader2,
  Moon,
  Palette,
  Sun,
  SunMoon,
  type LucideIcon,
} from "lucide-react"
import Image from "next/image"
import { ImageUpload } from "@/components/ui/image-upload"
import { GlassCard } from "@/components/glass"
import { NAV_ICON_MAP } from "@/components/layout/nav-icon-map"
import type { NavIconKey } from "@/shared/navigation/moduleRegistry"
import { MODULE_NAV_REGISTRY } from "@/shared/navigation/moduleRegistry"
import { PRODUCT_LINE_REGISTRY } from "@/shared/navigation/productLineRegistry"
import { flattenNavForLauncher, type LauncherAppItem } from "@/shared/navigation/flattenNav"
import type { AppAppearance } from "@/shared/navigation/companyNavPreferences"
import { cn } from "@/lib/utils"

function resolveIcon(key: NavIconKey): LucideIcon {
  return NAV_ICON_MAP[key]
}

type Segment = "product-lines" | "modules" | "appearance"

const SEGMENTS: { id: Segment; label: string; icon: LucideIcon }[] = [
  { id: "product-lines", label: "กลุ่มงาน", icon: Palette },
  { id: "modules", label: "โมดูลย่อย", icon: Layers },
  { id: "appearance", label: "ธีม", icon: SunMoon },
]

function groupModulesByProductLine(apps: LauncherAppItem[]) {
  return PRODUCT_LINE_REGISTRY.map((line) => {
    const deptSet = new Set(line.departmentIds)
    const seen = new Set<string>()
    const modules = apps.filter((app) => {
      if (!deptSet.has(app.departmentId)) return false
      if (seen.has(app.moduleId)) return false
      seen.add(app.moduleId)
      return true
    })
    return { line, modules }
  }).filter((g) => g.modules.length > 0)
}

export default function HomeScreenSettingsPage() {
  const t = useTranslations("settings")
  const router = useRouter()
  const [segment, setSegment] = useState<Segment>("product-lines")
  const [loading, setLoading] = useState(true)
  const [lineImages, setLineImages] = useState<Record<string, string>>({})
  const [moduleImages, setModuleImages] = useState<Record<string, string>>({})
  const [appearance, setAppearance] = useState<AppAppearance>("light")
  const [savedFlash, setSavedFlash] = useState(false)

  const moduleGroups = useMemo(
    () => groupModulesByProductLine(flattenNavForLauncher(MODULE_NAV_REGISTRY)),
    []
  )

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings/nav-preferences")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        setLineImages(json.data?.productLineImageOverrides ?? {})
        setModuleImages(json.data?.moduleImageOverrides ?? {})
        setAppearance(json.data?.appearance ?? "light")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const flashSaved = () => {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1600)
  }

  const patchPreferences = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/settings/nav-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      flashSaved()
      router.refresh()
      return true
    }
    return false
  }

  const chooseLineImage = async (lineId: string, imageUrl: string) => {
    const previous = lineImages
    const next = { ...lineImages }
    if (imageUrl) next[lineId] = imageUrl
    else delete next[lineId]
    setLineImages(next)
    const ok = await patchPreferences({
      productLineImageOverrides: { [lineId]: imageUrl },
    })
    if (!ok) setLineImages(previous)
  }

  const chooseModuleImage = async (moduleId: string, imageUrl: string) => {
    const previous = moduleImages
    const next = { ...moduleImages }
    if (imageUrl) next[moduleId] = imageUrl
    else delete next[moduleId]
    setModuleImages(next)
    const ok = await patchPreferences({
      moduleImageOverrides: { [moduleId]: imageUrl },
    })
    if (!ok) setModuleImages(previous)
  }

  const setAppearanceMode = async (next: AppAppearance) => {
    if (next === appearance) return
    const prev = appearance
    setAppearance(next)
    const ok = await patchPreferences({ appearance: next })
    if (!ok) setAppearance(prev)
  }

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-white via-slate-50 to-blue-50 px-6 py-7 shadow-sm dark:border-slate-700 dark:from-slate-800 dark:via-slate-850 dark:to-blue-950/40">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-700/20" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Palette className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-white">{t("homeScreenTitle")}</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                อัปโหลดไอคอนกลุ่มงานและโมดูลย่อยสำหรับ Sidebar /apps /app2 — ไฟล์ถูกเก็บที่{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground dark:bg-slate-700">
                  public/home-screen/
                </code>{" "}
                เพื่อ commit ขึ้น git แล้ว deploy ได้โดยไม่ต้องตั้งค่าบน VPS ใหม่
              </p>
            </div>
          </div>
          {savedFlash && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm backdrop-blur dark:border-emerald-800 dark:bg-slate-900/70 dark:text-emerald-300">
              <Check className="h-3.5 w-3.5" />
              บันทึกแล้ว
            </span>
          )}
        </div>
      </div>

      <div className="inline-flex flex-wrap rounded-xl border border-border bg-muted/80 p-1 dark:border-slate-700 dark:bg-slate-800">
        {SEGMENTS.map((s) => {
          const SegmentIcon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSegment(s.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                segment === s.id
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:text-blue-300 dark:ring-slate-600"
                  : "text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-slate-200"
              )}
            >
              <SegmentIcon className="h-4 w-4" />
              {s.label}
            </button>
          )
        })}
      </div>

      {segment === "product-lines" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-foreground">ไอคอนกลุ่มงาน</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              อัปโหลดรูปสี่เหลี่ยมจัตุรัสสำหรับแต่ละกลุ่มงาน — หากไม่อัปโหลดจะใช้ไอคอนเริ่มต้น
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PRODUCT_LINE_REGISTRY.map((line) => {
              const DefaultIcon = resolveIcon(line.iconKey)
              const imageUrl = lineImages[line.id]

              return (
                <GlassCard
                  key={line.id}
                  className="space-y-4 rounded-2xl border-border/80 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-white shadow-md",
                        line.accent
                      )}
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt=""
                          width={48}
                          height={48}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <DefaultIcon className="h-6 w-6" strokeWidth={1.9} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{line.labelTh}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {imageUrl ? "กำลังใช้ภาพที่อัปโหลด" : "กำลังใช้ไอคอนเริ่มต้น"}
                      </p>
                    </div>
                  </div>
                  <ImageUpload
                    value={imageUrl}
                    onChange={(url) => chooseLineImage(line.id, url)}
                    uploadProfile="homeScreenIcon"
                    assetKind="product-line"
                    assetId={line.id}
                  />
                </GlassCard>
              )
            })}
          </div>
        </section>
      )}

      {segment === "modules" && (
        <section className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-foreground">ไอคอนโมดูลย่อย</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              อัปโหลดรูปสำหรับ tile บนหน้า /apps และ /app2 — จัดกลุ่มตามกลุ่มงาน
            </p>
          </div>
          {moduleGroups.map(({ line, modules }) => (
            <div key={line.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full bg-gradient-to-br", line.accent)} />
                <h3 className="text-sm font-bold text-foreground">{line.labelTh}</h3>
                <span className="text-xs text-muted-foreground">{modules.length} โมดูล</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {modules.map((mod) => {
                  const DefaultIcon = resolveIcon(mod.icon)
                  const imageUrl = moduleImages[mod.moduleId]
                  return (
                    <GlassCard
                      key={mod.moduleId}
                      padding="sm"
                      className="space-y-3 rounded-xl border-border/80 shadow-sm dark:border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-foreground dark:bg-slate-700">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt=""
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <DefaultIcon className="h-5 w-5" strokeWidth={1.9} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{mod.label}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {imageUrl ? "ใช้ภาพที่อัปโหลด" : "ไอคอนเริ่มต้น"} · {mod.moduleId}
                          </p>
                        </div>
                      </div>
                      <ImageUpload
                        value={imageUrl}
                        onChange={(url) => chooseModuleImage(mod.moduleId, url)}
                        uploadProfile="homeScreenIcon"
                        assetKind="module"
                        assetId={mod.moduleId}
                      />
                    </GlassCard>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {segment === "appearance" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-foreground">รูปแบบการแสดงผล</h2>
            <p className="mt-1 text-sm text-muted-foreground">ปรับโทนสีให้เหมาะกับสภาพแวดล้อมการใช้งาน</p>
          </div>
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            {(
              [
                {
                  id: "light" as const,
                  label: "Light Mode",
                  description: "สว่าง โปร่ง และอ่านง่าย",
                  icon: Sun,
                  preview: "from-sky-100 via-indigo-100 to-rose-100",
                },
                {
                  id: "dark" as const,
                  label: "Dark Mode",
                  description: "เข้ม สุขุม และสบายตา",
                  icon: Moon,
                  preview: "from-slate-950 via-indigo-950 to-violet-900",
                },
              ] as const
            ).map((mode) => {
              const ModeIcon = mode.icon
              const selected = appearance === mode.id
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setAppearanceMode(mode.id)}
                  aria-pressed={selected}
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-card p-1.5 text-left shadow-sm transition-all dark:bg-slate-800",
                    selected
                      ? "border-blue-500 ring-2 ring-blue-500/15"
                      : "border-border hover:-translate-y-0.5 hover:border-border hover:shadow-md dark:border-slate-700 dark:hover:border-slate-600"
                  )}
                >
                  <div className={cn("relative h-28 overflow-hidden rounded-xl bg-gradient-to-br", mode.preview)}>
                    <div className="absolute inset-x-4 top-4 flex items-center justify-between">
                      <span
                        className={cn(
                          "h-2 w-16 rounded-full",
                          mode.id === "light" ? "bg-slate-700/60" : "bg-white/70"
                        )}
                      />
                      <span
                        className={cn(
                          "h-5 w-16 rounded-full border backdrop-blur",
                          mode.id === "light" ? "border-white/70 bg-white/65" : "border-white/20 bg-white/10"
                        )}
                      />
                    </div>
                    <div className="absolute inset-x-5 top-12 flex gap-2">
                      <span className="h-8 w-8 rounded-lg bg-blue-500 shadow" />
                      <span className="h-8 w-8 rounded-lg bg-emerald-500 shadow" />
                      <span className="h-8 w-8 rounded-lg bg-violet-500 shadow" />
                    </div>
                    <div
                      className={cn(
                        "absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-xl p-1.5 backdrop-blur",
                        mode.id === "light" ? "bg-white/65" : "bg-white/15"
                      )}
                    >
                      <span className="h-4 w-4 rounded bg-cyan-400" />
                      <span className="h-4 w-4 rounded bg-rose-400" />
                      <span className="h-4 w-4 rounded bg-amber-400" />
                    </div>
                    {selected && (
                      <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 px-2.5 py-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg",
                        selected
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"
                          : "bg-muted text-muted-foreground dark:bg-slate-700"
                      )}
                    >
                      <ModeIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{mode.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{mode.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
