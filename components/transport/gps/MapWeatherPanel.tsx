"use client"

import { useEffect, useState } from "react"
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  ExternalLink,
  Loader2,
  MapPin,
  Moon,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { WeatherPayload } from "@/shared/weather"
import { buildWindyRadarUrl } from "@/shared/weather/windy-url"

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

type Props = {
  open: boolean
  onClose: () => void
  lat: number
  lon: number
  placeLabel: string
}

export function MapWeatherPanel({ open, onClose, lat, lon, placeLabel }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [data, setData] = useState<WeatherPayload | null>(null)

  useEffect(() => {
    if (!open) {
      setStatus("idle")
      setData(null)
      return
    }

    let cancelled = false
    setStatus("loading")
    setData(null)

    const qs = `?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`
    fetch(`/api/weather${qs}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("weather failed")
        return res.json() as Promise<WeatherPayload>
      })
      .then((json) => {
        if (cancelled) return
        setData(json)
        setStatus("ok")
      })
      .catch(() => {
        if (cancelled) return
        setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [open, lat, lon])

  if (!open) return null

  const windyHref = buildWindyRadarUrl(lat, lon)
  const Icon = data ? weatherIcon(data.weatherCode, data.isDay) : Cloud

  return (
    <aside
      className={cn(
        "absolute right-3 top-14 z-[500] flex w-[min(100%-1.5rem,320px)] flex-col rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm",
        "dark:border-border dark:bg-card/95"
      )}
      aria-label="สภาพอากาศและเรดาร์"
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground">สภาพอากาศ / เรดาร์</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600 dark:text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{placeLabel}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="ปิดแผงอากาศ"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 px-3 py-3">
        {status === "loading" || status === "idle" ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            กำลังโหลดอากาศ...
          </div>
        ) : status === "error" ? (
          <p className="py-4 text-center text-sm text-red-600 dark:text-red-400">โหลดสภาพอากาศไม่ได้</p>
        ) : data ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-border dark:bg-muted/40">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-foreground">
                  {data.temperature}°
                </p>
                <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-foreground/90">{data.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  รู้สึกเหมือน {data.apparentTemperature}° · ความชื้น {data.humidity}%
                </p>
              </div>
              <Icon className="h-10 w-10 shrink-0 text-sky-600 dark:text-sky-300" strokeWidth={1.5} aria-hidden />
            </div>
          </div>
        ) : null}

        <a
          href={windyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-cyan-700"
        >
          เปิดเรดาร์บน Windy
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          ดูเรดาร์ฝนนอกแอปเพื่อเตรียมเส้นทาง — ไม่ฝังแผนที่ Windy ในระบบ
        </p>
      </div>
    </aside>
  )
}
