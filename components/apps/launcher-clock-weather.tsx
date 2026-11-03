"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { th } from "date-fns/locale"
import { useTranslations } from "next-intl"
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
import { fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import type { BotUsdRateSnapshot, MetalQuote, MetalsQuoteSnapshot } from "@/modules/raw_material_news/application/metals-quote-types"
import { metalBahtPerKg, metalMassUnit } from "@/modules/raw_material_news/application/metal-baht-per-kg"
import {
  BOT_EXCHANGE_RATE_PAGE_URL,
  INVESTING_METALS_URL,
} from "@/modules/raw_material_news/application/paper-market-constants"
import type { WeatherPayload } from "@/shared/weather"

const SLIDE_INTERVAL_MS = 60_000
const METALS_POLL_MS = 60_000

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

function formatLast(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value)
}

function formatChangePct(value: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  if (value > 0) return `+${formatted}%`
  if (value < 0) return `-${formatted}%`
  return `${formatted}%`
}

function changeClass(value: number): string {
  if (value > 0) return "text-emerald-700 dark:text-emerald-300"
  if (value < 0) return "text-red-700 dark:text-red-300"
  return "text-foreground dark:text-white"
}

function formatBotRate(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value)
}

function formatBotPeriod(period: string): string {
  const parsed = parseISO(period)
  if (Number.isNaN(parsed.getTime())) return period
  return format(parsed, "EEEE d MMM", { locale: th })
}

function mergeMetalsSnapshot(
  prev: MetalsQuoteSnapshot | null,
  data: MetalsQuoteSnapshot
): MetalsQuoteSnapshot {
  const quotes = data.quotes.length > 0 ? data.quotes : (prev?.quotes ?? [])
  const usdThb =
    data.usdThb?.rate != null ? data.usdThb : prev?.usdThb?.rate != null ? prev.usdThb : data.usdThb
  return {
    ...data,
    quotes,
    usdThb,
    error: quotes.length > 0 ? null : data.error,
  }
}

const RATE_CARD_CLASS =
  "flex shrink-0 flex-row items-center gap-4 rounded-2xl border border-white/50 bg-white/50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/30 lg:w-[14rem] lg:flex-col lg:items-start lg:justify-center lg:gap-1 lg:px-5 lg:py-4"

const RATE_FIGURE_STYLE = {
  fontFamily: "ui-rounded, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
} as const

function BotRateCard({ usd, loading }: { usd: BotUsdRateSnapshot | null; loading: boolean }) {
  const t = useTranslations("apps")
  const sourceUrl = usd?.sourceUrl || BOT_EXCHANGE_RATE_PAGE_URL

  if (usd?.rate != null && usd.period) {
    return (
      <div className={RATE_CARD_CLASS}>
        <div>
          <p className="text-xs font-medium capitalize tracking-wide text-muted-foreground dark:text-white/55 sm:text-sm">
            {formatBotPeriod(usd.period)}
          </p>
          <p
            className="mt-1 text-5xl font-light leading-none tracking-tight text-foreground tabular-nums sm:text-6xl dark:text-white"
            style={RATE_FIGURE_STYLE}
          >
            {formatBotRate(usd.rate)}
          </p>
          <p className="mt-1.5 text-[10px] font-medium text-muted-foreground dark:text-white/40">{t("botRateUnit")}</p>
          <p className="mt-0.5 max-w-[12rem] text-[10px] font-medium leading-snug text-muted-foreground dark:text-white/55">
            {t("botRateLabel")}
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={RATE_CARD_CLASS}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-white/60" />
          <p className="text-sm font-medium text-foreground dark:text-white/80">{t("botRateLoading")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={RATE_CARD_CLASS}>
      <div>
        <p className="text-sm font-semibold text-foreground dark:text-white/80">{t("botRateError")}</p>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex w-fit text-xs font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
        >
          {t("botRateSource")}
        </a>
      </div>
    </div>
  )
}

function formatBahtPerKg(value: number, troyOunce: boolean): string {
  const digits = troyOunce ? 0 : 2
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function MetalQuoteChip({ quote, usdThb }: { quote: MetalQuote; usdThb: number | null }) {
  const t = useTranslations("apps")
  const bahtPerKg = usdThb != null ? metalBahtPerKg(quote.name, quote.last, usdThb) : null
  const detail = [quote.month, quote.time].filter(Boolean).join(" · ")
  const subtitle = [bahtPerKg != null ? t("metalsPerKg") : null, detail].filter(Boolean).join(" · ")
  const rawTitle = [formatLast(quote.last), detail].filter(Boolean).join(" · ")

  return (
    <div
      className="min-w-0 rounded-lg border border-white/50 bg-gradient-to-br from-amber-200/25 via-white/55 to-sky-200/25 px-2 py-1.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:from-amber-400/10 dark:via-slate-950/35 dark:to-sky-500/15"
      title={rawTitle || undefined}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-1">
        <p className="truncate text-[11px] font-semibold text-foreground dark:text-white">{quote.name}</p>
        <p className={cn("shrink-0 text-[10px] font-semibold tabular-nums", changeClass(quote.changePct))}>
          {formatChangePct(quote.changePct)}
        </p>
      </div>
      <p className="mt-0.5 truncate text-sm font-semibold leading-none tracking-tight text-foreground tabular-nums dark:text-white">
        {bahtPerKg != null
          ? formatBahtPerKg(bahtPerKg, metalMassUnit(quote.name, quote.last) === "troyOz")
          : formatLast(quote.last)}
      </p>
      {subtitle ? (
        <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground dark:text-white/70">{subtitle}</p>
      ) : null}
    </div>
  )
}

function MetalsPanel({
  status,
  snapshot,
}: {
  status: "loading" | "ok" | "error"
  snapshot: MetalsQuoteSnapshot | null
}) {
  const t = useTranslations("apps")
  const sourceUrl = snapshot?.sourceUrl || INVESTING_METALS_URL
  const quotes = snapshot?.quotes ?? []
  const showMetalsLoading = status === "loading" && quotes.length === 0
  const showMetalsError = !showMetalsLoading && quotes.length === 0

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <BotRateCard usd={snapshot?.usdThb ?? null} loading={showMetalsLoading && snapshot?.usdThb?.rate == null} />
      <div className="min-w-0 flex-1">
        {showMetalsLoading ? (
          <div className="flex h-full min-h-[5.5rem] items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/40 px-4 py-3 dark:border-white/10 dark:bg-slate-950/30">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-white/60" />
            <p className="text-sm font-medium text-foreground dark:text-white/80">{t("metalsLoading")}</p>
          </div>
        ) : showMetalsError ? (
          <div className="flex h-full min-h-[5.5rem] flex-col justify-center rounded-2xl border border-dashed border-white/50 bg-white/30 px-4 py-3 dark:border-white/15 dark:bg-slate-950/20">
            <p className="text-sm font-semibold text-foreground dark:text-white/80">{t("metalsError")}</p>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex w-fit text-xs font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
            >
              {t("metalsSource")}
            </a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-1.5">
              {quotes.map((quote, index) => (
                <MetalQuoteChip
                  key={`${quote.name}-${quote.month ?? "spot"}-${quote.time}-${index}`}
                  quote={quote}
                  usdThb={snapshot?.usdThb.rate ?? null}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground dark:text-white/45">
              {t("metalsDisclaimer")}{" "}
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
              >
                {t("metalsSource")}
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  )
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
  const t = useTranslations("apps")
  const [now, setNow] = useState<Date | null>(null)
  const [items, setItems] = useState<BranchWeather[]>([])
  const [fallback, setFallback] = useState<BranchWeather | null>(null)
  const [slide, setSlide] = useState(0)
  const [metals, setMetals] = useState<MetalsQuoteSnapshot | null>(null)
  const [metalsStatus, setMetalsStatus] = useState<"loading" | "ok" | "error">("loading")

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
    const id = window.setInterval(() => {
      setSlide((current) => (current === 0 ? 1 : 0))
    }, SLIDE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadMetals() {
      try {
        const data = await fetchJson<MetalsQuoteSnapshot>("/api/raw-material-news/metals", {
          cache: "no-store",
        })
        if (cancelled) return
        setMetals((prev) => mergeMetalsSnapshot(prev, data))
        setMetalsStatus((prev) => (data.quotes.length > 0 || prev === "ok" ? "ok" : "error"))
      } catch {
        if (cancelled) return
        setMetalsStatus((prev) => (prev === "ok" ? "ok" : "error"))
      }
    }

    void loadMetals()
    const id = window.setInterval(() => void loadMetals(), METALS_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
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
      aria-label={slide === 0 ? t("metalsLabel") : t("clockWeatherLabel")}
    >
      <p className="sr-only" aria-live="polite">
        {slide === 0 ? t("metalsLabel") : t("clockWeatherLabel")}
      </p>
      <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl dark:bg-blue-500/15" />
      <div className="pointer-events-none absolute -right-8 top-0 h-36 w-36 rounded-full bg-amber-200/25 blur-3xl dark:bg-amber-300/10" />

      <div className="relative">
        <div
          className={cn(
            "transition duration-700 ease-in-out motion-reduce:transition-none",
            slide === 0
              ? "relative translate-x-0 opacity-100"
              : "pointer-events-none absolute inset-x-0 top-0 -translate-x-6 opacity-0"
          )}
          aria-hidden={slide !== 0}
          inert={slide !== 0}
        >
          <MetalsPanel status={metalsStatus} snapshot={metals} />
        </div>
        <div
          className={cn(
            "transition duration-700 ease-in-out motion-reduce:transition-none",
            slide === 1
              ? "relative translate-x-0 opacity-100"
              : "pointer-events-none absolute inset-x-0 top-0 translate-x-6 opacity-0"
          )}
          aria-hidden={slide !== 1}
          inert={slide !== 1}
        >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
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
          </div>
      </div>
    </section>
  )
}
