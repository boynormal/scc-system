"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { th } from "date-fns/locale"
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader2,
  MapPin,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { WeatherPayload } from "@/shared/weather"

export type WeatherBranchOption = {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
}

type BranchWeather = {
  branchId: string
  branchName: string
  status: "loading" | "ok" | "error"
  data?: WeatherPayload
}

function weatherIcon(code: number, isDay: boolean): LucideIcon {
  if (code === 0) return isDay ? Sun : Moon
  if (code === 1 || code === 2) return CloudSun
  if (code === 3) return Cloud
  if (code === 45 || code === 48) return CloudFog
  if (code >= 51 && code <= 57) return CloudDrizzle
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return CloudSnow
  if (code >= 95) return CloudLightning
  return Cloud
}

async function fetchWeather(lat?: number, lon?: number): Promise<WeatherPayload> {
  const qs =
    lat != null && lon != null
      ? `?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`
      : ""
  const res = await fetch(`/api/weather${qs}`)
  if (!res.ok) throw new Error("weather failed")
  return res.json() as Promise<WeatherPayload>
}

function BranchWeatherCard({ item }: { item: BranchWeather }) {
  if (item.status === "loading") {
    return (
      <div className="flex min-w-[8.25rem] flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/45 bg-white/40 px-2.5 py-2 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/30">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground dark:text-white/60" />
        <p className="truncate text-center text-[10px] font-medium text-muted-foreground dark:text-white/50">
          {item.branchName}
        </p>
      </div>
    )
  }

  if (item.status === "error" || !item.data) {
    return (
      <div className="flex min-w-[8.25rem] flex-1 flex-col justify-center rounded-xl border border-white/45 bg-white/40 px-2.5 py-2 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/30">
        <p className="truncate text-[11px] font-semibold text-foreground dark:text-white/80">{item.branchName}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground dark:text-white/50">โหลดอากาศไม่ได้</p>
      </div>
    )
  }

  const Icon = weatherIcon(item.data.weatherCode, item.data.isDay)

  return (
    <div className="relative flex min-w-[8.25rem] flex-1 flex-col overflow-hidden rounded-xl border border-white/50 bg-gradient-to-br from-sky-300/30 via-white/55 to-indigo-300/25 px-2.5 py-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:from-sky-500/15 dark:via-slate-950/35 dark:to-indigo-600/20">
      <div className="flex min-w-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground dark:text-white/65">
        <MapPin className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{item.branchName}</span>
      </div>
      <p className="mt-0.5 text-2xl font-semibold leading-none tracking-tight text-foreground tabular-nums dark:text-white">
        {item.data.temperature}°
      </p>
      <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground dark:text-white/70">
        {item.data.label}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-white/40 pt-1.5 dark:border-white/10">
        <div className="flex min-w-0 flex-wrap gap-x-1.5 text-[9px] leading-tight text-muted-foreground dark:text-white/50">
          <span>≈{item.data.apparentTemperature}°</span>
          <span>ชื้น {item.data.humidity}%</span>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-foreground/80 dark:text-white/80" strokeWidth={1.5} aria-hidden />
      </div>
    </div>
  )
}

export function LauncherClockWeather({
  branches = [],
  className,
}: {
  branches?: WeatherBranchOption[]
  className?: string
}) {
  const [now, setNow] = useState<Date | null>(null)
  const [items, setItems] = useState<BranchWeather[]>([])
  const [fallback, setFallback] = useState<BranchWeather | null>(null)

  const geoBranches = useMemo(
    () => branches.filter((b) => b.latitude != null && b.longitude != null),
    [branches]
  )

  const missingGpsCount = branches.length - geoBranches.length

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      // No company branches → Bangkok fallback
      if (branches.length === 0) {
        setItems([])
        setFallback({ branchId: "bangkok", branchName: "กรุงเทพฯ", status: "loading" })
        try {
          const data = await fetchWeather()
          if (!cancelled) {
            setFallback({
              branchId: "bangkok",
              branchName: data.locationName || "กรุงเทพฯ",
              status: "ok",
              data,
            })
          }
        } catch {
          if (!cancelled) {
            setFallback({ branchId: "bangkok", branchName: "กรุงเทพฯ", status: "error" })
          }
        }
        return
      }

      setFallback(null)

      if (geoBranches.length === 0) {
        setItems([])
        return
      }

      setItems(
        geoBranches.map((b) => ({
          branchId: b.id,
          branchName: b.name,
          status: "loading" as const,
        }))
      )

      const results = await Promise.all(
        geoBranches.map(async (b) => {
          try {
            const data = await fetchWeather(b.latitude!, b.longitude!)
            return {
              branchId: b.id,
              branchName: b.name,
              status: "ok" as const,
              data: { ...data, locationName: b.name },
            }
          } catch {
            return {
              branchId: b.id,
              branchName: b.name,
              status: "error" as const,
            }
          }
        })
      )

      if (!cancelled) setItems(results)
    }

    void loadAll()
    const refresh = window.setInterval(() => void loadAll(), 10 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(refresh)
    }
  }, [branches, geoBranches])

  const timeText = now ? format(now, "HH:mm") : "--:--"
  const seconds = now ? format(now, "ss") : "--"
  const dateText = now ? format(now, "EEEE d MMM", { locale: th }) : "…"

  const weatherCards =
    branches.length === 0 && fallback
      ? [fallback]
      : items

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/40 p-3 shadow-lg backdrop-blur-xl dark:border-white/15 dark:bg-slate-950/35 sm:p-4",
        className
      )}
      aria-label="นาฬิกาและสภาพอากาศตามสาขา"
    >
      <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl dark:bg-blue-500/15" />
      <div className="pointer-events-none absolute -right-8 top-0 h-36 w-36 rounded-full bg-amber-200/25 blur-3xl dark:bg-amber-300/10" />

      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {/* Compact clock — frees space for weather */}
        <div className="flex shrink-0 flex-row items-center gap-4 rounded-2xl border border-white/50 bg-white/50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/30 lg:w-[14rem] lg:flex-col lg:items-start lg:justify-center lg:gap-1 lg:px-5 lg:py-4">
          <div>
            <p className="text-xs font-medium capitalize tracking-wide text-muted-foreground dark:text-white/55 sm:text-sm">
              {dateText}
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <time
                dateTime={now?.toISOString()}
                className="text-5xl font-light leading-none tracking-tight text-foreground tabular-nums sm:text-6xl dark:text-white"
                style={{ fontFamily: "ui-rounded, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif" }}
              >
                {timeText}
              </time>
              <span className="pb-1 text-base font-medium text-muted-foreground tabular-nums sm:text-lg dark:text-white/45">
                {seconds}
              </span>
            </div>
            <p className="mt-1.5 text-[10px] font-medium text-muted-foreground dark:text-white/40">Asia/Bangkok</p>
          </div>
        </div>

        {/* Branch weather strip — expands into former clock space */}
        <div className="min-w-0 flex-1">
          {branches.length > 0 && geoBranches.length === 0 ? (
            <div className="flex h-full min-h-[5.5rem] flex-col justify-center rounded-2xl border border-dashed border-white/50 bg-white/30 px-4 py-3 dark:border-white/15 dark:bg-slate-950/20">
              <p className="text-sm font-semibold text-foreground dark:text-white/80">
                ยังไม่มีสาขาที่มีพิกัด GPS
              </p>
              <p className="mt-1 text-xs text-muted-foreground dark:text-white/50">
                ตั้งพิกัดในหน้าสาขา เพื่อแสดงอากาศทุกสาขาที่นี่
              </p>
              <Link
                href="/settings/branches"
                className="mt-2 inline-flex w-fit text-xs font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
              >
                ไปตั้งค่าสาขา
              </Link>
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {weatherCards.map((item) => (
                  <BranchWeatherCard key={item.branchId} item={item} />
                ))}
              </div>
              {missingGpsCount > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground dark:text-white/45">
                  มี {missingGpsCount} สาขาที่ยังไม่มีพิกัด —{" "}
                  <Link
                    href="/settings/branches"
                    className="font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
                  >
                    ตั้งค่าพิกัด
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
