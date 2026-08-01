"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslations } from "next-intl"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { hasAnyAlert } from "@/components/transport/gps/GpsAlertBadge"
import { VehicleGpsRow } from "@/components/transport/gps/VehicleGpsRow"
import { VehicleGpsCard } from "@/components/transport/gps/VehicleGpsCard"
import { RefreshCw, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const POLL_INTERVAL = 45_000

type Filter = "all" | "alert" | "available" | "busy" | "maintenance"

export default function TransportMonitorPage() {
  const t = useTranslations("transport")
  const [vehicles, setVehicles] = useState<GpsVehicleData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
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

  const filtered = vehicles.filter((v) => {
    if (filter === "alert" && !hasAnyAlert(v.alerts)) return false
    if (filter === "available" && !v.available) return false
    if (filter === "busy" && (v.available || v.vehicleDbStatus === "maintenance")) return false
    if (filter === "maintenance" && v.vehicleDbStatus !== "maintenance") return false
    if (search && !v.plateNumber.toLowerCase().includes(search.toLowerCase()) &&
      !v.driverName.toLowerCase().includes(search.toLowerCase()) &&
      !(v.activeJob?.jobNumber ?? "").toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    total: vehicles.length,
    alert: vehicles.filter((v) => hasAnyAlert(v.alerts)).length,
    moving: vehicles.filter((v) => v.speed > 0).length,
    available: vehicles.filter((v) => v.available).length,
    busy: vehicles.filter((v) => !v.available && v.vehicleDbStatus !== "maintenance").length,
    maintenance: vehicles.filter((v) => v.vehicleDbStatus === "maintenance").length,
  }

  const FILTERS: { key: Filter; label: string; count: number; icon?: React.ReactNode }[] = [
    { key: "all", label: t("filterAll"), count: stats.total },
    { key: "available", label: "ว่าง", count: stats.available },
    { key: "busy", label: "ไม่ว่าง", count: stats.busy },
    { key: "maintenance", label: "ซ่อมบำรุง", count: stats.maintenance },
    { key: "alert", label: "มี Alert", count: stats.alert, icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("monitorTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("monitorDesc")}
            {" · "}
            {lastFetch ? `อัปเดต ${lastFetch.toLocaleTimeString("th-TH")}` : "กำลังโหลด..."}
            {" · "}รีเฟรชอัตโนมัติใน {countdown}s
          </p>
        </div>
        <button
          onClick={() => { fetchGps(); setCountdown(POLL_INTERVAL / 1000) }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/60"
        >
          <RefreshCw className="h-4 w-4" /> {t("refresh")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="รถทั้งหมด" value={stats.total} color="bg-muted text-foreground" />
        <StatCard label="ว่าง" value={stats.available} color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" />
        <StatCard label="ไม่ว่าง" value={stats.busy} color={stats.busy > 0 ? "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" : "bg-muted text-muted-foreground"} />
        <StatCard label="กำลังวิ่ง" value={stats.moving} color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" />
        <StatCard label="มี Alert" value={stats.alert} color={stats.alert > 0 ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-muted text-muted-foreground"} />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.icon}
              {f.label}
              {f.count > 0 && (
                <span className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  f.key === "alert" && f.count > 0 ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" : "bg-muted text-muted-foreground"
                )}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="ค้นหาทะเบียน / คนขับ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
      </div>

      {/* Selected vehicle detail card — อยู่เหนือตาราง */}
      {selectedId && (() => {
        const v = vehicles.find((x) => x.id === selectedId)
        if (!v) return null
        return (
          <div className="rounded-xl border border-cyan-200 bg-card p-4 shadow-sm dark:border-cyan-800">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">รายละเอียดรถที่เลือก</span>
              <button
                onClick={() => setSelectedId(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕ ปิด
              </button>
            </div>
            <VehicleGpsCard vehicle={v} />
          </div>
        )
      })()}

      {/* Table — page scroll is on transport layout (far right edge) */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {error ? (
          <div className="px-6 py-10 text-center text-sm text-red-500">{error}</div>
        ) : loading ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">กำลังโหลดข้อมูล GPS...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">ทะเบียน</th>
                <th className="px-4 py-3 text-left">ความพร้อม</th>
                <th className="px-4 py-3 text-left">GSM</th>
                <th className="px-4 py-3 text-left">สถานะ</th>
                <th className="px-4 py-3 text-left">ความเร็ว</th>
                <th className="px-4 py-3 text-left">ไมล์สะสม</th>
                <th className="px-4 py-3 text-left">แบตเตอรี่</th>
                <th className="px-4 py-3 text-left">ใบงานวันนี้</th>
                <th className="px-4 py-3 text-left">ที่อยู่</th>
                <th className="px-4 py-3 text-left">อัปเดต</th>
                <th className="px-4 py-3 text-left">Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">ไม่พบข้อมูล</td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <VehicleGpsRow
                    key={v.id}
                    vehicle={v}
                    selected={v.id === selectedId}
                    onClick={() => setSelectedId(v.id === selectedId ? null : v.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn("rounded-xl border border-border p-3 shadow-sm", color)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-75">{label}</p>
    </div>
  )
}
