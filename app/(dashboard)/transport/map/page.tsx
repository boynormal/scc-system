"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { TransportMap } from "@/components/transport/gps/TransportMap"
import { MapVehicleListItem } from "@/components/transport/gps/MapVehicleListItem"
import { UnmatchedMapVehicleListItem } from "@/components/transport/gps/UnmatchedMapVehicleListItem"
import { MapWeatherPanel } from "@/components/transport/gps/MapWeatherPanel"
import { hasAnyAlert } from "@/components/transport/gps/GpsAlertBadge"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { RefreshCw, AlertTriangle, CloudSun, List, ListCollapse } from "lucide-react"
import {
  TransportSearchField,
  TransportSegmentedTabs,
} from "@/components/transport/toolbar"
import { WEATHER_DEFAULT_COORDS } from "@/shared/weather/windy-url"

const POLL_INTERVAL = 45_000
const VEHICLES_MASTER_HREF = "/transport/master-data?tab=vehicles"

type AvailabilityFilter = "all" | "available" | "busy" | "maintenance" | "unmatched"

export default function TransportMapPage() {
  const t = useTranslations("transport")
  const [vehicles, setVehicles] = useState<GpsVehicleData[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000)
  const [search, setSearch] = useState("")
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all")
  const [listCompact, setListCompact] = useState(true)
  const [weatherOpen, setWeatherOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchGps = useCallback(async () => {
    try {
      const res = await fetch("/api/transport/gps")
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? t("loadFailed"))
        return
      }
      setVehicles(json.data ?? [])
      setLastFetch(new Date())
      setError(null)
      setCountdown(POLL_INTERVAL / 1000)
    } catch {
      setError(t("loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchGps()
    timerRef.current = setInterval(fetchGps, POLL_INTERVAL)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : POLL_INTERVAL / 1000))
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchGps])

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (availabilityFilter === "unmatched" && v.matchedInDb) return false
      if (availabilityFilter === "available" && (!v.available || !v.matchedInDb)) return false
      if (availabilityFilter === "busy" && (v.available || !v.matchedInDb || v.vehicleDbStatus === "maintenance")) return false
      if (availabilityFilter === "maintenance" && v.vehicleDbStatus !== "maintenance") return false
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (
        v.plateNumber.toLowerCase().includes(q) ||
        v.imei.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q) ||
        v.address.toLowerCase().includes(q) ||
        v.near.toLowerCase().includes(q) ||
        (v.activeJob?.jobNumber ?? "").toLowerCase().includes(q)
      )
    })
  }, [vehicles, search, availabilityFilter])

  const matchedVehicles = vehicles.filter((v) => v.matchedInDb)
  const unmatchedCount = vehicles.filter((v) => !v.matchedInDb).length
  const availableCount = matchedVehicles.filter((v) => v.available).length
  const maintenanceCount = matchedVehicles.filter((v) => v.vehicleDbStatus === "maintenance").length
  const busyCount = matchedVehicles.filter((v) => !v.available && v.vehicleDbStatus !== "maintenance").length

  const alertCount = vehicles.filter((v) => hasAnyAlert(v.alerts)).length
  const movingCount = vehicles.filter((v) => v.speed > 0).length

  const weatherTarget = useMemo(() => {
    const selected = selectedId ? vehicles.find((v) => v.id === selectedId) : undefined
    if (selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng) && selected.lat !== 0 && selected.lng !== 0) {
      const plate = selected.plateNumber?.trim() || selected.asset?.trim() || "รถที่เลือก"
      return { lat: selected.lat, lon: selected.lng, placeLabel: plate }
    }
    return {
      lat: WEATHER_DEFAULT_COORDS.lat,
      lon: WEATHER_DEFAULT_COORDS.lon,
      placeLabel: WEATHER_DEFAULT_COORDS.label,
    }
  }, [selectedId, vehicles])

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-border bg-card">
        {/* Header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t("vehiclesTitle")}</h2>
              <p className="text-xs text-muted-foreground">
                {vehicles.length} คัน · กำลังวิ่ง {movingCount} คัน
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setListCompact((c) => !c)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={listCompact ? "ขยายรายการ" : "ย่อรายการ"}
                aria-label={listCompact ? "ขยายรายการ" : "ย่อรายการ"}
                aria-pressed={listCompact}
              >
                {listCompact ? <List className="h-4 w-4" /> : <ListCollapse className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => { fetchGps(); setCountdown(POLL_INTERVAL / 1000) }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={t("refresh")}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {lastFetch ? `อัปเดต ${lastFetch.toLocaleTimeString("th-TH")}` : "กำลังโหลด..."}
            {" · "}รีเฟรชใน {countdown}s
          </p>

          {/* Availability filter */}
          <TransportSegmentedTabs
            size="sm"
            className="mt-2 flex w-full"
            activeKey={availabilityFilter}
            onChange={(key) => setAvailabilityFilter(key as AvailabilityFilter)}
            items={(
              [
                { key: "all" as const, label: t("filterAll"), count: vehicles.length },
                { key: "available" as const, label: "ว่าง", count: availableCount },
                { key: "busy" as const, label: "ไม่ว่าง", count: busyCount },
                { key: "maintenance" as const, label: "ซ่อม", count: maintenanceCount },
                { key: "unmatched" as const, label: "ไม่ match", count: unmatchedCount },
              ] as const
            ).map((f) => ({
              key: f.key,
              label: f.label,
              count: f.count > 0 ? f.count : undefined,
            }))}
          />

          <TransportSearchField
            className="mt-2 w-full max-w-none"
            inputClassName="text-xs"
            value={search}
            onChange={setSearch}
            placeholder="ค้นหาทะเบียน / คนขับ / ที่อยู่..."
          />
        </div>

        {/* Unmatched GPS banner */}
        {unmatchedCount > 0 && (
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 dark:border-amber-900/40 dark:bg-amber-950/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                {unmatchedCount} คันจาก GPS ยังไม่ได้ลงทะเบียนในระบบ
              </div>
              <Link
                href={VEHICLES_MASTER_HREF}
                className="shrink-0 text-[11px] font-medium text-amber-800 underline hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100"
              >
                ไปเพิ่มที่ข้อมูลพื้นฐาน
              </Link>
            </div>
          </div>
        )}
        {/* Alert summary */}
        {alertCount > 0 && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-2 dark:border-red-900/40 dark:bg-red-950/40">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {alertCount} คันมี Alert
            </div>
          </div>
        )}

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              กำลังโหลด...
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-center text-sm text-red-500">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {search || availabilityFilter !== "all"
                ? "ไม่พบรถที่ตรงกับตัวกรอง"
                : "ไม่พบข้อมูลรถ"}
            </div>
          ) : (
            <ul>
              {filtered.map((v) =>
                v.matchedInDb ? (
                  <MapVehicleListItem
                    key={v.id}
                    vehicle={v}
                    selected={v.id === selectedId}
                    compact={listCompact}
                    onClick={() => setSelectedId(v.id === selectedId ? null : v.id)}
                  />
                ) : (
                  <UnmatchedMapVehicleListItem
                    key={v.id}
                    vehicle={v}
                    selected={v.id === selectedId}
                    compact={listCompact}
                    onClick={() => setSelectedId(v.id === selectedId ? null : v.id)}
                  />
                )
              )}
            </ul>
          )}
        </div>
      </aside>

      {/* Map area */}
      <div className="relative flex-1">
        {error && !loading && (
          <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 shadow">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => setWeatherOpen((o) => !o)}
          className={
            weatherOpen
              ? "absolute left-3 top-3 z-[500] inline-flex items-center gap-1.5 rounded-lg border border-cyan-600 bg-cyan-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-md hover:bg-cyan-700"
              : "absolute left-3 top-3 z-[500] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-md backdrop-blur-sm hover:bg-slate-50 dark:border-border dark:bg-card/95 dark:text-foreground dark:hover:bg-muted"
          }
          aria-pressed={weatherOpen}
          aria-label={weatherOpen ? "ปิดแผงอากาศ" : "เปิดแผงอากาศและดาวเทียม"}
          title="สภาพอากาศ / ดาวเทียม"
        >
          <CloudSun className="h-4 w-4" />
          ดาวเทียม
        </button>
        <MapWeatherPanel
          open={weatherOpen}
          onClose={() => setWeatherOpen(false)}
          lat={weatherTarget.lat}
          lon={weatherTarget.lon}
          placeLabel={weatherTarget.placeLabel}
        />
        <TransportMap
          vehicles={filtered}
          selectedId={selectedId}
          onSelectVehicle={setSelectedId}
          height="100%"
        />
      </div>
      </div>
    </div>
  )
}
