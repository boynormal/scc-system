"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { TransportMap } from "@/components/transport/gps/TransportMap"
import { MapVehicleListItem } from "@/components/transport/gps/MapVehicleListItem"
import { UnmatchedMapVehicleListItem } from "@/components/transport/gps/UnmatchedMapVehicleListItem"
import { LinkGpsVehicleModal } from "@/components/transport/LinkGpsVehicleModal"
import { hasAnyAlert } from "@/components/transport/gps/GpsAlertBadge"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { RefreshCw, AlertTriangle, Search } from "lucide-react"
import { cn } from "@/lib/utils"
const POLL_INTERVAL = 30_000

type AvailabilityFilter = "all" | "available" | "busy" | "unmatched"

export default function TransportMapPage() {
  const [vehicles, setVehicles] = useState<GpsVehicleData[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000)
  const [search, setSearch] = useState("")
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all")
  const [linkModalGps, setLinkModalGps] = useState<GpsVehicleData | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchGps = useCallback(async () => {
    try {
      const res = await fetch("/api/transport/gps")
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "ไม่สามารถดึงข้อมูล GPS ได้")
        return
      }
      setVehicles(json.data ?? [])
      setLastFetch(new Date())
      setError(null)
      setCountdown(POLL_INTERVAL / 1000)
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ GPS")
    } finally {
      setLoading(false)
    }
  }, [])

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
      if (availabilityFilter === "busy" && (v.available || !v.matchedInDb)) return false
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
  const busyCount = matchedVehicles.filter((v) => !v.available).length

  const alertCount = vehicles.filter((v) => hasAnyAlert(v.alerts)).length
  const movingCount = vehicles.filter((v) => v.speed > 0).length

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-slate-200 bg-white">
        {/* Header */}
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">ยานพาหนะ</h2>
              <p className="text-xs text-slate-500">
                {vehicles.length} คัน · กำลังวิ่ง {movingCount} คัน
              </p>
            </div>
            <button
              onClick={() => { fetchGps(); setCountdown(POLL_INTERVAL / 1000) }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="รีเฟรช"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {lastFetch ? `อัปเดต ${lastFetch.toLocaleTimeString("th-TH")}` : "กำลังโหลด..."}
            {" · "}รีเฟรชใน {countdown}s
          </p>

          {/* Availability filter */}
          <div className="mt-2 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                { key: "all" as const, label: "ทั้งหมด", count: vehicles.length },
                { key: "available" as const, label: "ว่าง", count: availableCount },
                { key: "busy" as const, label: "ไม่ว่าง", count: busyCount },
                { key: "unmatched" as const, label: "ไม่ match", count: unmatchedCount },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setAvailabilityFilter(f.key)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                  availabilityFilter === f.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {f.label}
                {f.count > 0 && (
                  <span className="ml-1 text-[10px] opacity-70">({f.count})</span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาทะเบียน / คนขับ / ที่อยู่..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
        </div>

        {/* Unmatched GPS banner */}
        {unmatchedCount > 0 && (
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                {unmatchedCount} คันจาก GPS ยังไม่ได้ลงทะเบียนในระบบ
              </div>
              <button
                type="button"
                onClick={() => {
                  const first = vehicles.find((v) => !v.matchedInDb)
                  if (first) setLinkModalGps(first)
                }}
                className="shrink-0 text-[11px] font-medium text-amber-800 underline hover:text-amber-950"
              >
                ผูก GPS
              </button>
            </div>
          </div>
        )}
        {/* Alert summary */}
        {alertCount > 0 && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {alertCount} คันมี Alert
            </div>
          </div>
        )}

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-400">
              กำลังโหลด...
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-center text-sm text-red-500">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">
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
                    onClick={() => setSelectedId(v.id === selectedId ? null : v.id)}
                  />
                ) : (
                  <UnmatchedMapVehicleListItem
                    key={v.id}
                    vehicle={v}
                    selected={v.id === selectedId}
                    onClick={() => setSelectedId(v.id === selectedId ? null : v.id)}
                    onLinkClick={(vehicle) => setLinkModalGps(vehicle)}
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
        <TransportMap
          vehicles={filtered}
          selectedId={selectedId}
          onSelectVehicle={setSelectedId}
          height="100%"
        />
      </div>

      <LinkGpsVehicleModal
        open={!!linkModalGps}
        gpsVehicle={
          linkModalGps
            ? { plateNumber: linkModalGps.plateNumber, imei: linkModalGps.imei }
            : null
        }
        gpsVehicles={vehicles}
        onSuccess={() => {
          setLinkModalGps(null)
          fetchGps()
        }}
        onCancel={() => setLinkModalGps(null)}
      />
    </div>
  )
}
