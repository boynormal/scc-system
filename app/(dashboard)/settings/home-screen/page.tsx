"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  Loader2,
  Moon,
  Palette,
  Sun,
  SunMoon,
  type LucideIcon,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { ImageUpload } from "@/components/ui/image-upload"
import { NAV_ICON_MAP } from "@/components/layout/nav-icon-map"
import type { NavIconKey } from "@/shared/navigation/moduleRegistry"
import { PRODUCT_LINE_REGISTRY } from "@/shared/navigation/productLineRegistry"
import type { AppAppearance } from "@/shared/navigation/companyNavPreferences"
import { cn } from "@/lib/utils"

function resolveIcon(key: NavIconKey): LucideIcon {
  return NAV_ICON_MAP[key]
}

type Segment = "icons" | "appearance"

const SEGMENTS: { id: Segment; label: string; icon: LucideIcon }[] = [
  { id: "icons", label: "ไอคอน", icon: Palette },
  { id: "appearance", label: "ธีม", icon: SunMoon },
]

export default function HomeScreenSettingsPage() {
  const router = useRouter()
  const [segment, setSegment] = useState<Segment>("icons")
  const [loading, setLoading] = useState(true)
  const [images, setImages] = useState<Record<string, string>>({})
  const [appearance, setAppearance] = useState<AppAppearance>("light")
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings/nav-preferences")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        setImages(json.data?.productLineImageOverrides ?? {})
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
      return true
    }
    return false
  }

  const chooseImage = async (lineId: string, imageUrl: string) => {
    const previous = images
    const next = { ...images }
    if (imageUrl) next[lineId] = imageUrl
    else delete next[lineId]
    setImages(next)
    const ok = await patchPreferences({
      productLineImageOverrides: { [lineId]: imageUrl },
    })
    if (!ok) setImages(previous)
  }

  const setAppearanceMode = async (next: AppAppearance) => {
    if (next === appearance) return
    const prev = appearance
    setAppearance(next)
    const ok = await patchPreferences({ appearance: next })
    if (!ok) setAppearance(prev)
    else router.refresh()
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
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50 px-6 py-7 shadow-sm dark:border-slate-700 dark:from-slate-800 dark:via-slate-850 dark:to-blue-950/40">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-700/20" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Palette className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">หน้าจอหลัก</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                กำหนดรูปลักษณ์ของ Launcher สำหรับผู้ใช้ทุกคนในบริษัท
                ระบบจะบันทึกการเปลี่ยนแปลงให้อัตโนมัติ
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

      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800">
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
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              <SegmentIcon className="h-4 w-4" />
              {s.label}
            </button>
          )
        })}
      </div>

      {segment === "icons" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">ไอคอนหมวดหมู่</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              เลือกไอคอนที่จดจำง่ายสำหรับแต่ละกลุ่มงาน — อัปโหลดรูปสี่เหลี่ยมจัตุรัส ระบบจะครอปและปรับให้พอดี
              โดยอัตโนมัติ หากไม่อัปโหลดจะใช้ไอคอนเริ่มต้น
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PRODUCT_LINE_REGISTRY.map((line) => {
              const DefaultIcon = resolveIcon(line.iconKey)
              const imageUrl = images[line.id]

              return (
                <Card key={line.id} className="space-y-4 rounded-2xl border-slate-200/80 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-white shadow-md",
                        line.accent
                      )}
                    >
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <DefaultIcon className="h-6 w-6" strokeWidth={1.9} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{line.labelTh}</p>
                      <p className="truncate text-xs text-slate-400">
                        {imageUrl ? "กำลังใช้ภาพที่อัปโหลด" : "กำลังใช้ไอคอนเริ่มต้น"}
                      </p>
                    </div>
                  </div>
                  <ImageUpload
                    value={imageUrl}
                    onChange={(url) => chooseImage(line.id, url)}
                    uploadProfile="productLineIcon"
                  />
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {segment === "appearance" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">รูปแบบการแสดงผล</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              ปรับโทนสีให้เหมาะกับสภาพแวดล้อมการใช้งาน
            </p>
          </div>
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            {([
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
            ]).map((mode) => {
              const ModeIcon = mode.icon
              const selected = appearance === mode.id
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setAppearanceMode(mode.id)}
                  aria-pressed={selected}
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-white p-1.5 text-left shadow-sm transition-all dark:bg-slate-800",
                    selected
                      ? "border-blue-500 ring-2 ring-blue-500/15"
                      : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:hover:border-slate-600"
                  )}
                >
                  <div className={cn("relative h-28 overflow-hidden rounded-xl bg-gradient-to-br", mode.preview)}>
                    <div className="absolute inset-x-4 top-4 flex items-center justify-between">
                      <span className={cn("h-2 w-16 rounded-full", mode.id === "light" ? "bg-slate-700/60" : "bg-white/70")} />
                      <span className={cn("h-5 w-16 rounded-full border backdrop-blur", mode.id === "light" ? "border-white/70 bg-white/65" : "border-white/20 bg-white/10")} />
                    </div>
                    <div className="absolute inset-x-5 top-12 flex gap-2">
                      <span className="h-8 w-8 rounded-lg bg-blue-500 shadow" />
                      <span className="h-8 w-8 rounded-lg bg-emerald-500 shadow" />
                      <span className="h-8 w-8 rounded-lg bg-violet-500 shadow" />
                    </div>
                    <div className={cn("absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-xl p-1.5 backdrop-blur", mode.id === "light" ? "bg-white/65" : "bg-white/15")}>
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
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", selected ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300" : "bg-slate-100 text-slate-500 dark:bg-slate-700")}>
                      <ModeIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{mode.label}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{mode.description}</p>
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
