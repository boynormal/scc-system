"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toPng } from "html-to-image"
import { Calendar, Clock, Download, MapPin, Play, Route } from "lucide-react"
import {
  describeLegFlag,
  kindsForStop,
  LEG_MAX_DWELL_MINUTES,
  LEG_MIN_AVERAGE_SPEED_KMH,
  legEndpointLabel,
  PUNCH_MIN_GAP_MS,
  usesTripBookends,
  type JobLegFlag,
  type JobLegKind,
  type PunchKind,
} from "@/modules/transport/application/job-punch-rules"
import { cn } from "@/lib/utils"

type Stop = {
  id: string
  sequence: number
  customerName: string
  address: string
  status: string
}

type Punch = {
  id: string
  stopId: string | null
  kind: PunchKind
  recordedAt: string
  odometerKm: number | null
  latitude: number | null
  longitude: number | null
  gpsLatitude: number | null
  gpsLongitude: number | null
}

type Leg = {
  fromStopId: string | null
  fromKind: PunchKind
  toStopId: string | null
  toKind: PunchKind
  minutes: number
  km: number | null
  kind: JobLegKind
  flag: JobLegFlag
}

type NextStep = { stopId: string | null; kind: PunchKind }
type Tone = "green" | "blue" | "violet"

function formatWhen(value: string) {
  const parts = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(value))
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${pick("day")} ${pick("month")} ${pick("hour")}:${pick("minute")}`
}

function mapsUrl(punch: Punch) {
  const latitude = punch.latitude ?? punch.gpsLatitude
  const longitude = punch.longitude ?? punch.gpsLongitude
  if (latitude == null || longitude == null) return null
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}

function mapOf(punches: Array<Punch | undefined>) {
  for (const punch of [...punches].reverse()) {
    if (!punch) continue
    const url = mapsUrl(punch)
    if (url) return url
  }
  return null
}

function latestOdometer(punches: Array<Punch | undefined>) {
  for (const punch of [...punches].reverse()) {
    if (punch?.odometerKm != null) return punch.odometerKm
  }
  return null
}

function readPosition() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null)
  return new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
}

export function JobPunchPanel({
  jobId,
  jobNumber,
  vehiclePlate,
  driverName,
  cargoType,
  branchName,
  stops,
  punches,
  legs,
  next,
  canSkipStopId,
  canRecord,
}: {
  jobId: string
  jobNumber: string
  vehiclePlate: string | null
  driverName: string | null
  cargoType: string | null
  branchName: string
  stops: Stop[]
  punches: Punch[]
  legs: Leg[]
  next: NextStep | null
  canSkipStopId: string | null
  canRecord: boolean
}) {
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingImage, setSavingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const bookends = usesTripBookends(punches)
  const orderedStops = [...stops].sort((a, b) => a.sequence - b.sequence)
  const stopName = (id: string) => stops.find((stop) => stop.id === id)?.customerName ?? "จุด"
  const endpoint = (kind: PunchKind, stopId: string | null) => legEndpointLabel(kind, stopId, stopName)
  const startPunch = punches.find((item) => item.kind === "start")
  const finishPunch = punches.find((item) => item.kind === "finish")
  const headerWhen = [...punches].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]?.recordedAt
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const serverLockUntil = headerWhen ? new Date(headerWhen).getTime() + PUNCH_MIN_GAP_MS : 0
  const gapRemainingMs = Math.max(lockedUntil ?? 0, serverLockUntil) - nowMs
  const cooling = gapRemainingMs > 0
  const waitSeconds = Math.max(1, Math.ceil(gapRemainingMs / 1000))

  useEffect(() => {
    if (!cooling) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [cooling])

  const postPunch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/transport/jobs/${jobId}/punches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error?.message ?? json.error ?? "บันทึกไม่สำเร็จ")
      return false
    }
    return true
  }

  const recordNext = async () => {
    if (!next || busyRef.current || cooling) return
    busyRef.current = true
    setPending(true)
    setError(null)
    try {
      const position = await readPosition()
      const body =
        next.kind === "start" || next.kind === "finish"
          ? { kind: next.kind, ...position }
          : { stopId: next.stopId, kind: next.kind, ...position }
      const saved = await postPunch(body)
      if (!saved) return
      const locked = Date.now() + PUNCH_MIN_GAP_MS
      setLockedUntil(locked)
      setNowMs(Date.now())
      router.refresh()
    } catch {
      setError("บันทึกไม่สำเร็จ")
    } finally {
      busyRef.current = false
      setPending(false)
    }
  }

  const skipNext = async () => {
    if (!next?.stopId || busyRef.current || cooling) return
    busyRef.current = true
    setPending(true)
    setError(null)
    try {
      const saved = await postPunch({ action: "skip", stopId: next.stopId })
      if (saved) router.refresh()
    } catch {
      setError("บันทึกไม่สำเร็จ")
    } finally {
      busyRef.current = false
      setPending(false)
    }
  }

  const downloadImage = async () => {
    if (!cardRef.current || savingImage) return
    setSavingImage(true)
    setImageError(null)
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.punchDownload != null),
      })
      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `${jobNumber}.png`
      link.click()
    } catch {
      setImageError("สร้างรูปไม่สำเร็จ")
    } finally {
      setSavingImage(false)
    }
  }

  const statusLine = !next
    ? "บันทึกครบทุกช่วงเวลาแล้ว"
    : canRecord && cooling
      ? `บันทึกแล้ว รออีก ${waitSeconds} วินาที`
      : canRecord
        ? `ถัดไป · ${nextHeading(next, stopName, bookends)}`
        : "เปิดดูได้อย่างเดียว"

  return (
    <div ref={cardRef} className="overflow-hidden rounded-3xl bg-slate-50 shadow-sm ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
      <header className="relative overflow-hidden bg-gradient-to-br from-[#163e73] via-[#1d5aa8] to-[#3b8fd4] px-4 pb-5 pt-4 text-white">
        <MapPin className="pointer-events-none absolute -right-2 top-6 h-24 w-24 text-white/10" />
        <MapPin className="pointer-events-none absolute right-10 top-2 h-10 w-10 text-white/15" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/80">{jobNumber}</p>
              <h1 className="text-lg font-bold leading-tight">บันทึกเวลาและเลขไมล์</h1>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {headerWhen ? (
                <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1.5 text-xs font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatWhen(headerWhen)}
                </div>
              ) : null}
              <div data-punch-download="" className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={() => void downloadImage()}
                  disabled={savingImage}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1.5 text-xs font-medium hover:bg-white/25 disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  {savingImage ? "กำลังสร้างรูป" : "ดาวน์โหลดรูป"}
                </button>
                {imageError ? <p className="text-[11px] text-red-100">{imageError}</p> : null}
              </div>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-1.5">
            {(
              [
                ["รถ", vehiclePlate || "—"],
                ["คนขับ", driverName || "—"],
                ["สินค้า", cargoType || "—"],
                ["สาขา", branchName],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex min-w-0 items-baseline gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs">
                <dt className="shrink-0 text-white/70">{label} :</dt>
                <dd className="min-w-0 truncate font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-sm text-white/80">{statusLine}</p>
        </div>
      </header>

      <div className="space-y-3 px-3 py-4">
        {canRecord && next ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">{cooling ? "บันทึกแล้ว" : "จังหวะถัดไป"}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
              {cooling ? `รออีก ${waitSeconds} วินาทีก่อนจังหวะถัดไป` : nextHeading(next, stopName, bookends)}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={pending || cooling}
                onClick={() => void recordNext()}
                className="w-full rounded-xl bg-[#1d5aa8] px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
              >
                {pending ? "กำลังบันทึก..." : cooling ? `รออีก ${waitSeconds} วินาที` : nextButton(next, bookends)}
              </button>
              {next.stopId && canSkipStopId === next.stopId && !cooling ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void skipNext()}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  ข้ามจุดนี้
                </button>
              ) : null}
            </div>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </section>
        ) : null}

        {bookends ? (
          <BookendCard
            tone="green"
            icon="play"
            title="จุดเริ่มต้น"
            place="เริ่มงาน"
            punch={startPunch}
            odometerLabel="เลขไมล์เริ่มต้น"
            leg={legs.find((leg) => leg.fromKind === "start")}
          />
        ) : null}

        {orderedStops.map((stop, index) => {
          const kinds = kindsForStop(stops, stop.id, punches)
          const inactive = stop.status === "skipped" || stop.status === "cancelled"
          const arrive = punches.find((item) => item.stopId === stop.id && item.kind === "arrive")
          const depart = punches.find((item) => item.stopId === stop.id && item.kind === "depart")
          const rows = (kinds ?? []).map((kind) => ({
            kind,
            label: stopKindLabel(kind, bookends),
            punch: kind === "arrive" ? arrive : depart,
          }))
          return (
            <StopCard
              key={stop.id}
              number={index + 1}
              title={`จุดที่ ${stop.sequence}`}
              name={stop.customerName}
              address={stop.address}
              inactiveLabel={inactive ? (stop.status === "skipped" ? "ข้ามจุดนี้" : "ยกเลิก") : null}
              rows={rows}
              odometerKm={latestOdometer(rows.map((row) => row.punch))}
              mapHref={mapOf(rows.map((row) => row.punch))}
              leg={legs.find((leg) => leg.kind === "dwell" && leg.fromStopId === stop.id)}
            />
          )
        })}

        {bookends ? (
          <BookendCard
            tone="violet"
            icon="number"
            number={orderedStops.length + 1}
            title="จุดสิ้นสุด"
            place="จบงาน"
            punch={finishPunch}
            odometerLabel="เลขไมล์"
            leg={legs.find((leg) => leg.toKind === "finish")}
          />
        ) : null}

        <section className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:ring-sky-900">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-white">
              <Route className="h-3.5 w-3.5" />
            </span>
            เวลาและกิโลเมตร
          </h2>
          {legs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">ยังไม่มีขาให้เทียบ</p>
          ) : (
            <ul className="space-y-2">
              {legs.map((leg, index) => {
                const warning = describeLegFlag(leg)
                const tone = legTone(index, legs.length)
                return (
                  <li
                    key={`${leg.fromStopId}-${leg.fromKind}-${leg.toStopId}-${leg.toKind}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                        toneBadge(tone)
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-800 dark:text-slate-100">
                        {endpoint(leg.fromKind, leg.fromStopId)} → {endpoint(leg.toKind, leg.toStopId)}
                        {leg.minutes > 0 ? <span className="text-slate-500"> · {leg.minutes} นาที</span> : null}
                      </p>
                      {warning ? <p className="text-xs font-semibold text-red-600">{warning}</p> : null}
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", tonePill(tone))}>
                      {leg.km != null ? `${leg.km.toLocaleString()} กม.` : "รอเลขไมล์"}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function BookendCard({
  tone,
  icon,
  number,
  title,
  place,
  punch,
  odometerLabel,
  leg,
}: {
  tone: "green" | "violet"
  icon: "play" | "number"
  number?: number
  title: string
  place: string
  punch: Punch | undefined
  odometerLabel: string
  leg: Leg | undefined
}) {
  const map = punch ? mapsUrl(punch) : null
  return (
    <section className={cn("rounded-2xl p-4 ring-1", tone === "green" ? toneCard("green") : toneCard("violet"))}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
              tone === "green" ? toneBadge("green") : toneBadge("violet")
            )}
          >
            {icon === "play" ? <Play className="h-4 w-4" fill="currentColor" /> : number}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {place}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {punch ? formatWhen(punch.recordedAt) : "ยังไม่บันทึก"}
            </p>
            {map ? <MapButton href={map} /> : null}
          </div>
        </div>
      </div>
      <MetricStrip
        tone={tone}
        metrics={legMetrics(leg, punch?.odometerKm ?? null, odometerLabel)}
      />
    </section>
  )
}

function StopCard({
  number,
  title,
  name,
  address,
  inactiveLabel,
  rows,
  odometerKm,
  mapHref,
  leg,
}: {
  number: number
  title: string
  name: string
  address: string
  inactiveLabel: string | null
  rows: { kind: "arrive" | "depart"; label: string; punch: Punch | undefined }[]
  odometerKm: number | null
  mapHref: string | null
  leg: Leg | undefined
}) {
  return (
    <section className={cn("rounded-2xl p-4 ring-1", toneCard("blue"))}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
              toneBadge("blue")
            )}
          >
            {number}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              {title} <span className="font-semibold">{name}</span>
            </h2>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{address}</span>
            </p>
            {inactiveLabel ? (
              <p className="mt-3 text-sm text-slate-500">{inactiveLabel}</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {rows.map((row) => (
                  <li key={row.kind} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                    <Clock className={cn("h-3.5 w-3.5", row.kind === "arrive" ? "text-emerald-500" : "text-orange-500")} />
                    <span className="font-medium">{row.label}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {row.punch ? formatWhen(row.punch.recordedAt) : "ยังไม่บันทึก"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {mapHref ? <MapButton href={mapHref} /> : null}
          </div>
        </div>
      </div>
      {inactiveLabel ? null : (
        <DwellStrip minutes={leg?.kind === "dwell" ? leg.minutes : null} odometerKm={odometerKm} over={leg?.flag === "long_dwell"} />
      )}
    </section>
  )
}

type LegMetrics = {
  minutes: number | null
  km: number | null
  average: number | null
  odometerKm: number | null
  odometerLabel: string
  warning: string | null
}

function averageSpeed(leg: Leg) {
  if (leg.km == null || leg.minutes <= 0) return null
  return Math.round((leg.km / (leg.minutes / 60)) * 10) / 10
}

function legMetrics(leg: Leg | undefined, odometerKm: number | null, odometerLabel: string): LegMetrics {
  if (!leg) {
    return { minutes: null, km: null, average: null, odometerKm, odometerLabel, warning: null }
  }
  if (leg.kind === "dwell") {
    return {
      minutes: leg.minutes,
      km: leg.km,
      average: null,
      odometerKm,
      odometerLabel,
      warning: leg.flag === "long_dwell" ? `จอดเกินเกณฑ์ ${LEG_MAX_DWELL_MINUTES} นาที` : null,
    }
  }
  return {
    minutes: leg.minutes,
    km: leg.km,
    average: averageSpeed(leg),
    odometerKm,
    odometerLabel,
    warning: leg.flag === "slow_travel" ? `ต่ำกว่าเกณฑ์ ${LEG_MIN_AVERAGE_SPEED_KMH} กม./ชม.` : null,
  }
}

function DwellStrip({
  minutes,
  odometerKm,
  over,
}: {
  minutes: number | null
  odometerKm: number | null
  over?: boolean
}) {
  return (
    <div className="mt-3">
      <div className={cn("rounded-2xl px-3 py-3 text-center", over ? "bg-red-50 dark:bg-red-950/50" : toneSoft("blue"))}>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">จอดรับส่ง</p>
        <p className={cn("text-lg font-bold leading-tight", over ? "text-red-700 dark:text-red-300" : toneText("blue"))}>
          {minutes != null ? `${minutes.toLocaleString()} นาที` : "—"}
        </p>
        {odometerKm != null ? (
          <p className="mt-0.5 text-[10px] leading-tight text-slate-500">เลขไมล์ {odometerKm.toLocaleString()}</p>
        ) : null}
      </div>
      {minutes != null ? (
        <p className={cn("mt-2 text-center text-xs font-semibold", over ? "text-red-600" : "text-slate-500")}>
          {over ? `จอดเกินเกณฑ์ ${LEG_MAX_DWELL_MINUTES} นาที` : `ภายในเกณฑ์ ${LEG_MAX_DWELL_MINUTES} นาที`}
        </p>
      ) : null}
    </div>
  )
}

function MetricStrip({ metrics, tone }: { metrics: LegMetrics; tone: Tone }) {
  const cells = [
    { label: "เวลา", value: metrics.minutes != null ? `${metrics.minutes.toLocaleString()} นาที` : "—", hint: null },
    {
      label: "กิโล",
      value: metrics.km != null ? `${metrics.km.toLocaleString()} กม.` : "—",
      hint: metrics.odometerKm != null ? `${metrics.odometerLabel} ${metrics.odometerKm.toLocaleString()}` : null,
    },
    {
      label: "เฉลี่ย",
      value: metrics.average != null ? `${metrics.average.toLocaleString()} กม./ชม.` : "—",
      hint: null,
    },
  ]
  return (
    <div className="mt-3">
      <div className={cn("grid grid-cols-3 gap-2 rounded-2xl p-2", toneSoft(tone))}>
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0 px-1 py-1 text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{cell.label}</p>
            <p className={cn("text-lg font-bold leading-tight", toneText(tone))}>{cell.value}</p>
            {cell.hint ? <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{cell.hint}</p> : null}
          </div>
        ))}
      </div>
      {metrics.warning ? (
        <p className="mt-2 text-center text-xs font-semibold text-red-600">{metrics.warning}</p>
      ) : null}
    </div>
  )
}

function MapButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
    >
      <MapPin className="h-3.5 w-3.5" />
      เปิดแผนที่
    </a>
  )
}

function nextHeading(next: NextStep, stopName: (id: string) => string, bookends: boolean) {
  if (next.kind === "start") return "เริ่มงาน"
  if (next.kind === "finish") return "จบงาน"
  const name = next.stopId ? stopName(next.stopId) : "จุด"
  if (!bookends) return `${next.kind === "depart" ? "ออก" : "ถึง"} · ${name}`
  return `${next.kind === "depart" ? "ออกจากจุด" : "ถึง"} · ${name}`
}

function nextButton(next: NextStep, bookends: boolean) {
  if (next.kind === "start") return "บันทึกเริ่มงาน"
  if (next.kind === "finish") return "บันทึกจบงาน"
  if (!bookends) return next.kind === "depart" ? "บันทึกออก" : "บันทึกถึง"
  return next.kind === "depart" ? "บันทึกออกจากจุด" : "บันทึกถึง"
}

function stopKindLabel(kind: "arrive" | "depart", bookends: boolean) {
  if (kind === "arrive") return "ถึง"
  return bookends ? "ออกจากจุด" : "ออก"
}

function legTone(index: number, count: number): Tone {
  if (index === 0) return "green"
  if (index === count - 1) return "violet"
  return "blue"
}

function toneCard(tone: Tone) {
  if (tone === "green") return "bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-900"
  if (tone === "violet") return "bg-violet-50 ring-violet-100 dark:bg-violet-950/30 dark:ring-violet-900"
  return "bg-white ring-blue-100 dark:bg-slate-900 dark:ring-slate-700"
}

function toneBadge(tone: Tone) {
  if (tone === "green") return "bg-emerald-500"
  if (tone === "violet") return "bg-violet-500"
  return "bg-blue-600"
}

function toneSoft(tone: Tone) {
  if (tone === "green") return "bg-emerald-100/80 dark:bg-emerald-900/40"
  if (tone === "violet") return "bg-violet-100/80 dark:bg-violet-900/40"
  return "bg-blue-50 dark:bg-blue-950/40"
}

function toneText(tone: Tone) {
  if (tone === "green") return "text-emerald-600 dark:text-emerald-300"
  if (tone === "violet") return "text-violet-600 dark:text-violet-300"
  return "text-blue-600 dark:text-blue-300"
}

function tonePill(tone: Tone) {
  if (tone === "green") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
  if (tone === "violet") return "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200"
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"
}
