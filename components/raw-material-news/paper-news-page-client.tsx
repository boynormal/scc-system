"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ExternalLink, RefreshCw } from "lucide-react"
import { GlassStatCard } from "@/components/glass"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { fetchJson, ClientFetchError } from "@/lib/client-fetch"
import { cn, formatDateTime } from "@/lib/utils"
import type {
  FxSeriesStats,
  PaperMarketSnapshot,
} from "@/modules/raw_material_news/application/paper-market-types"
import {
  FREIGHTOS_FBX02_URL,
  FX_HISTORY_SOURCE_URL,
  FX_LATEST_SOURCE_URL,
  SUNSIRS_GRAPH_URL,
  SUNSIRS_WASTEPAPER_URL,
} from "@/modules/raw_material_news/application/paper-market-constants"
import { cnyThbForDate, rmbTonToThb, usdThbForDate, usdToThb } from "@/modules/raw_material_news/infra/thb-convert"

function thbForSunsirsRow(
  rmbPerTon: number,
  date: string,
  fx: PaperMarketSnapshot["fx"]
) {
  return rmbTonToThb(rmbPerTon, cnyThbForDate(date, fx?.history ?? [], fx?.cnyThb ?? null))
}

function thbForFreightUsd(
  usd: number,
  date: string,
  fx: PaperMarketSnapshot["fx"]
) {
  return usdToThb(usd, usdThbForDate(date, fx?.history ?? [], fx?.usdThb ?? null))
}

function formatRate(value: number, digits = 4): string {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

function trendFromPct(value: number | null): "up" | "down" | "neutral" {
  if (value == null || value === 0) return "neutral"
  return value > 0 ? "up" : "down"
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatOrDash(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return formatNumber(value, digits)
}

function StatsRow({
  stats,
  t,
}: {
  stats: FxSeriesStats
  t: (key: string) => string
}) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
      <div className="rounded-lg bg-muted/60 px-2 py-2">
        <p className="text-muted-foreground">{t("statsMin")}</p>
        <p className="font-semibold tabular-nums">{formatRate(stats.min)}</p>
      </div>
      <div className="rounded-lg bg-muted/60 px-2 py-2">
        <p className="text-muted-foreground">{t("statsMax")}</p>
        <p className="font-semibold tabular-nums">{formatRate(stats.max)}</p>
      </div>
      <div className="rounded-lg bg-muted/60 px-2 py-2">
        <p className="text-muted-foreground">{t("statsAvg")}</p>
        <p className="font-semibold tabular-nums">{formatRate(stats.avg)}</p>
      </div>
    </div>
  )
}

function SunsirsOfficialChart({
  alt,
  failedLabel,
  credit,
}: {
  alt: string
  failedLabel: string
  credit: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{failedLabel}</p>
        <SourceLink href={SUNSIRS_WASTEPAPER_URL} label={credit} />
      </div>
    )
  }

  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- third-party chart; avoid next/image remotePatterns + server fetch */}
      <img
        src={SUNSIRS_GRAPH_URL}
        alt={alt}
        width={900}
        height={420}
        className="w-full rounded-lg border border-border bg-white object-contain"
        onError={() => setFailed(true)}
      />
      <figcaption className="text-xs text-muted-foreground">{credit}</figcaption>
    </figure>
  )
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )
}

function FxSourceCite({ latestLabel, historyLabel }: { latestLabel: string; historyLabel: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <SourceLink href={FX_LATEST_SOURCE_URL} label={latestLabel} />
      <span aria-hidden="true">·</span>
      <SourceLink href={FX_HISTORY_SOURCE_URL} label={historyLabel} />
    </p>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <details
      open
      className="rounded-xl border border-border bg-card text-foreground shadow-sm"
    >
      <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </summary>
      <div className="border-t border-border px-5 py-4">{children}</div>
    </details>
  )
}

export function PaperNewsPageClient({
  title,
  description,
  backLabel,
}: {
  title: string
  description: string
  backLabel: string
}) {
  const t = useTranslations("rawMaterialNews")
  const [data, setData] = useState<PaperMarketSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const json = await fetchJson<PaperMarketSnapshot>("/api/raw-material-news/paper")
      setData(json)
    } catch (err) {
      const message = err instanceof ClientFetchError ? err.message : t("loadFailed")
      setError(message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const freightThbCurrent =
    data?.freight != null ? usdToThb(data.freight.currentUsd, data.fx?.usdThb) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/raw-material-news"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {backLabel}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {data?.fetchedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("updatedAt", { time: formatDateTime(data.fetchedAt) })}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          icon={<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />}
        >
          {t("refresh")}
        </Button>
      </div>

      {loading && !data && <LoadingState title={t("loadingPaper")} className="py-12" />}
      {error && !data && (
        <ErrorState title={t("loadFailed")} description={error} onRetry={() => void load()} />
      )}

      {data && (
        <div className="space-y-4">
          <SectionCard title={t("fxTitle")} description={t("fxDesc")}>
            {data.errors.fx && !data.fx ? (
              <div className="space-y-3">
                <ErrorState
                  title={t("loadFailed")}
                  description={data.errors.fx}
                  onRetry={() => void load()}
                  className="py-8"
                />
                <FxSourceCite latestLabel={t("fxSourceLatest")} historyLabel={t("fxSourceHistory")} />
              </div>
            ) : data.fx ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <GlassStatCard
                    label={t("usdThb")}
                    value={formatRate(data.fx.usdThb)}
                    trend={{
                      value: `${formatPct(data.fx.stats.usd.changePct)} ${t("changeVsPrev")}`,
                      direction: trendFromPct(data.fx.stats.usd.changePct),
                    }}
                  />
                  <GlassStatCard
                    label={t("cnyThb")}
                    value={formatRate(data.fx.cnyThb)}
                    trend={{
                      value: `${formatPct(data.fx.stats.cny.changePct)} ${t("changeVsPrev")}`,
                      direction: trendFromPct(data.fx.stats.cny.changePct),
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-1 text-sm font-medium">{t("usdThb")}</p>
                    <StatsRow stats={data.fx.stats.usd} t={t} />
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium">{t("cnyThb")}</p>
                    <StatsRow stats={data.fx.stats.cny} t={t} />
                  </div>
                </div>
                <div className="h-64 w-full">
                  <p className="mb-2 text-sm font-medium">{t("history30d")}</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.fx.history}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                      <YAxis
                        yAxisId="usd"
                        tick={{ fontSize: 11 }}
                        domain={["auto", "auto"]}
                        width={48}
                      />
                      <YAxis
                        yAxisId="cny"
                        orientation="right"
                        tick={{ fontSize: 11 }}
                        domain={["auto", "auto"]}
                        width={48}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          formatRate(Number(value)),
                          name === "usdThb" ? t("usdThb") : t("cnyThb"),
                        ]}
                      />
                      <Line
                        yAxisId="usd"
                        type="monotone"
                        dataKey="usdThb"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        name="usdThb"
                      />
                      <Line
                        yAxisId="cny"
                        type="monotone"
                        dataKey="cnyThb"
                        stroke="#d97706"
                        strokeWidth={2}
                        dot={false}
                        name="cnyThb"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <FxSourceCite latestLabel={t("fxSourceLatest")} historyLabel={t("fxSourceHistory")} />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title={t("sunsirsTitle")} description={t("sunsirsDesc")}>
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <div className="min-w-0 lg:sticky lg:top-4">
                <SunsirsOfficialChart
                  alt={t("sunsirsChartAlt")}
                  failedLabel={t("sunsirsChartFailed")}
                  credit={t("sunsirsChartCredit")}
                />
              </div>
              <div className="min-w-0 space-y-4">
                {data.errors.sunsirs && !data.sunsirs ? (
                  <ErrorState
                    title={t("loadFailed")}
                    description={data.errors.sunsirs}
                    onRetry={() => void load()}
                    className="py-8"
                  />
                ) : data.sunsirs ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <GlassStatCard
                        label={t("sunsirsPrice")}
                        value={formatNumber(data.sunsirs.latest, 0)}
                        hint={t("sunsirsUnit")}
                        trend={{
                          value: formatPct(data.sunsirs.changePct),
                          direction: trendFromPct(data.sunsirs.changePct),
                        }}
                      />
                      <GlassStatCard
                        label={t("sunsirsIndex")}
                        value={formatNumber(data.sunsirs.index, 2)}
                        hint={data.sunsirs.commodity}
                      />
                      <GlassStatCard
                        label={t("sunsirsPriceThbTon")}
                        value={formatOrDash(
                          thbForSunsirsRow(
                            data.sunsirs.latest,
                            data.sunsirs.history.at(-1)?.date ?? "",
                            data.fx
                          )?.thbPerTon
                        )}
                      />
                      <GlassStatCard
                        label={t("sunsirsPriceThbKg")}
                        value={formatOrDash(
                          thbForSunsirsRow(
                            data.sunsirs.latest,
                            data.sunsirs.history.at(-1)?.date ?? "",
                            data.fx
                          )?.thbPerKg
                        )}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{t("sunsirsDemandUnavailable")}</p>
                    <p className="text-xs text-muted-foreground">{t("sunsirsFxNote")}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[32rem] text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="py-2 pr-3 font-medium">{t("date")}</th>
                            <th className="py-2 pr-3 font-medium">{t("sunsirsPrice")}</th>
                            <th className="py-2 pr-3 font-medium">{t("sunsirsIndex")}</th>
                            <th className="py-2 pr-3 font-medium">{t("sunsirsPriceThbTon")}</th>
                            <th className="py-2 font-medium">{t("sunsirsPriceThbKg")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...data.sunsirs.history].reverse().map((row) => {
                            const converted = thbForSunsirsRow(row.price, row.date, data.fx)
                            return (
                              <tr key={row.date} className="border-b border-border/60">
                                <td className="py-1.5 pr-3 tabular-nums">{row.date}</td>
                                <td className="py-1.5 pr-3 tabular-nums">{formatNumber(row.price, 2)}</td>
                                <td className="py-1.5 pr-3 tabular-nums">{formatNumber(row.index, 2)}</td>
                                <td className="py-1.5 pr-3 tabular-nums">
                                  {formatOrDash(converted?.thbPerTon)}
                                </td>
                                <td className="py-1.5 tabular-nums">{formatOrDash(converted?.thbPerKg)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
                <SourceLink href={SUNSIRS_WASTEPAPER_URL} label={t("openSource")} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t("freightTitle")} description={t("freightDesc")}>
            {data.errors.freight && !data.freight ? (
              <div className="space-y-3">
                <ErrorState
                  title={t("loadFailed")}
                  description={data.errors.freight}
                  onRetry={() => void load()}
                  className="py-8"
                />
                <SourceLink href={FREIGHTOS_FBX02_URL} label={t("openSource")} />
              </div>
            ) : data.freight ? (
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                <div className="min-w-0 lg:sticky lg:top-4">
                  {data.freight.history.length > 1 ? (
                    <div className="h-64 w-full">
                      <p className="mb-2 text-sm font-medium">{t("freightWeeklyChart")}</p>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.freight.history}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                          <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} width={48} />
                          <Tooltip
                            formatter={(value, _name, item) => {
                              const usd = Number(value)
                              const date = String(
                                (item?.payload as { date?: string } | undefined)?.date ?? ""
                              )
                              const thb = thbForFreightUsd(usd, date, data.fx)
                              const usdLabel = `$${formatNumber(usd, 2)}`
                              const thbLabel =
                                thb != null ? `฿${formatNumber(thb, 2)}` : "—"
                              return [`${usdLabel} · ${thbLabel}`, t("freightCurrent")]
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#2563eb"
                            strokeWidth={2}
                            dot={false}
                            name="value"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("freightHistoryNote")}</p>
                  )}
                </div>
                <div className="min-w-0 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <GlassStatCard
                      label={t("freightCurrent")}
                      value={`$${formatNumber(data.freight.currentUsd, 2)}`}
                      hint={data.freight.lane}
                      trend={{
                        value: `${formatPct(data.freight.changePct)} ${t("changeVsPrev")}`,
                        direction: trendFromPct(data.freight.changePct),
                      }}
                    />
                    <GlassStatCard
                      label={t("freightThb")}
                      value={
                        freightThbCurrent != null
                          ? `฿${formatNumber(freightThbCurrent, 2)}`
                          : "—"
                      }
                      hint={
                        data.fx
                          ? `${t("freightThbUnit")} · ${t("usdThb")} ${formatRate(data.fx.usdThb)}`
                          : t("freightThbUnit")
                      }
                    />
                    <GlassStatCard
                      label={t("freightVolatility")}
                      value={
                        data.freight.volatilityPct != null
                          ? `${formatNumber(data.freight.volatilityPct, 2)}%`
                          : "—"
                      }
                    />
                    <GlassStatCard
                      label={t("freightChange")}
                      value={formatPct(data.freight.changePct)}
                      trend={{
                        value: t("changeVsPrev"),
                        direction: trendFromPct(data.freight.changePct),
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{t("freightFxNote")}</p>
                  <p className="text-xs text-muted-foreground">{t("freightHistoryNote")}</p>
                  <SourceLink href={data.freight.sourceUrl} label={t("openSource")} />
                </div>
              </div>
            ) : null}
          </SectionCard>
        </div>
      )}
    </div>
  )
}
