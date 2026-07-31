"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Check, Layers, Loader2, Palette, type LucideIcon } from "lucide-react"
import Image from "next/image"
import { ImageUpload } from "@/components/ui/image-upload"
import { GlassCard } from "@/components/glass"
import { NAV_ICON_MAP } from "@/components/layout/nav-icon-map"
import type { NavIconKey } from "@/shared/navigation/moduleRegistry"
import { MODULE_NAV_REGISTRY } from "@/shared/navigation/moduleRegistry"
import { PRODUCT_LINE_REGISTRY } from "@/shared/navigation/productLineRegistry"
import { flattenNavForLauncher, type LauncherAppItem } from "@/shared/navigation/flattenNav"
import { cn } from "@/lib/utils"

function resolveIcon(key: NavIconKey): LucideIcon {
  return NAV_ICON_MAP[key]
}

type Segment = "product-lines" | "modules"

const SEGMENTS: { id: Segment; label: string; icon: LucideIcon }[] = [
  { id: "product-lines", label: "กลุ่มงาน", icon: Palette },
  { id: "modules", label: "โมดูลย่อย", icon: Layers },
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
                {t("homeScreenDesc")}
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
    </div>
  )
}
