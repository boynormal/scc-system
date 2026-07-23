import type { GpsVehicleData } from "@/app/api/transport/gps/route"

export function parseSignalPercent(val: string): number | null {
  if (!val.trim()) return null
  const n = parseFloat(val.replace(/[^0-9.]/g, ""))
  if (Number.isNaN(n)) return null
  return Math.min(100, Math.max(0, n))
}

function formatBatteryValue(valueOnly: string): string {
  const numMatch = valueOnly.match(/([\d.]+)/)
  if (!numMatch) return valueOnly
  const n = parseFloat(numMatch[1])
  if (Number.isNaN(n)) return valueOnly
  const intVal = Math.round(n)
  const suffix = valueOnly.slice(numMatch.index! + numMatch[1].length)
  return `${intVal}${suffix}`
}

export function formatBatteryLabel(battery: string, options?: { short?: boolean }): string | null {
  const trimmed = battery.trim()
  if (!trimmed) return null
  const valueOnly = trimmed.replace(/^แบต(?:เตอรี่)?\s*/i, "").trim() || trimmed
  const formatted = formatBatteryValue(valueOnly)
  if (options?.short) {
    const numMatch = formatted.match(/^(\d+)/)
    if (!numMatch) return `B.${formatted}`
    const suffix = formatted.slice(numMatch[1].length).trim()
    return suffix ? `B.${numMatch[1]} ${suffix}` : `B.${numMatch[1]}`
  }
  return formatted
}

export function formatMileageLabel(mileage: string): string | null {
  const trimmed = mileage.trim()
  if (!trimmed) return null
  if (/km|ก\.?ม\.?|ไมล์/i.test(trimmed)) return trimmed
  const n = parseFloat(trimmed.replace(/[^0-9.]/g, ""))
  if (Number.isNaN(n)) return trimmed
  return `${n.toLocaleString("th-TH", { maximumFractionDigits: 1 })} km`
}

type GpsStatusKind = "offline" | "moving" | "engineOn" | "engineOff" | "unknown"

function resolveGpsStatusKind(
  label: string,
  v: Pick<GpsVehicleData, "online" | "speed" | "engineOn">
): GpsStatusKind {
  const upper = label.toUpperCase()

  if (upper === "OFFLINE" || /^offline$/i.test(label.trim())) return "offline"

  if (v.speed > 0) return "moving"
  if (/วิ่ง|เคลื่อนที่|running/i.test(label) && !label.includes("จอดรถ")) return "moving"

  if (label.includes("ดับเครื่อง")) return "engineOff"

  if (label.includes("เครื่องยนต์ทำงาน") || label.includes("ติดเครื่อง")) return "engineOn"
  if (v.engineOn) return "engineOn"

  if (label.includes("จอดรถ")) return "engineOff"

  if (!v.online) return "offline"

  return "unknown"
}

const GPS_STATUS_COLORS: Record<GpsStatusKind, { className: string; bg: string; text: string }> = {
  offline: { className: "bg-slate-200 text-slate-600", bg: "#e2e8f0", text: "#475569" },
  moving: { className: "bg-green-100 text-green-700", bg: "#dcfce7", text: "#15803d" },
  engineOn: { className: "bg-amber-100 text-amber-700", bg: "#fef3c7", text: "#b45309" },
  engineOff: { className: "bg-blue-100 text-blue-700", bg: "#dbeafe", text: "#1d4ed8" },
  unknown: { className: "bg-slate-100 text-slate-700", bg: "#f1f5f9", text: "#334155" },
}

export function getGpsStatusColors(
  label: string,
  v: Pick<GpsVehicleData, "online" | "speed" | "engineOn">
) {
  return GPS_STATUS_COLORS[resolveGpsStatusKind(label, v)]
}

function getGpsStatusClassName(
  label: string,
  v: Pick<GpsVehicleData, "online" | "speed" | "engineOn">
): string {
  return getGpsStatusColors(label, v).className
}

export function getMovementStatus(v: Pick<GpsVehicleData, "online" | "speed" | "engineOn" | "status">): {
  label: string
  className: string
} {
  const gpsStatus = v.status?.trim()
  if (gpsStatus) {
    return {
      label: gpsStatus,
      className: getGpsStatusClassName(gpsStatus, v),
    }
  }

  if (!v.online) return { label: "OFFLINE", className: "bg-slate-200 text-slate-600" }
  if (v.speed > 0) return { label: "กำลังวิ่ง", className: "bg-green-100 text-green-700" }
  if (v.engineOn) return { label: "ติดเครื่อง", className: "bg-amber-100 text-amber-700" }
  return { label: "ดับเครื่อง", className: "bg-blue-100 text-blue-700" }
}

export function signalBarColor(pct: number): string {
  if (pct > 30) return "bg-green-500"
  if (pct > 15) return "bg-amber-500"
  return "bg-red-500"
}

export function buildCalendarTodayHref(vehicleDbId: string | null): string | null {
  if (!vehicleDbId) return null
  return `/transport/calendar?vehicleId=${vehicleDbId}&date=today`
}

/** HTML helpers for Leaflet popup (no React) */
export function buildGsmBarHtml(gsm: string): string {
  const pct = parseSignalPercent(gsm)
  if (pct === null) return ""
  const color = signalBarColor(pct) === "bg-green-500" ? "#22c55e" : signalBarColor(pct) === "bg-amber-500" ? "#f59e0b" : "#ef4444"
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
      <span style="font-size:11px;color:#94a3b8">GSM</span>
      <div style="flex:1;height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:99px"></div>
      </div>
      <span style="font-size:11px;color:#64748b;font-weight:600;width:32px;text-align:right">${pct}%</span>
    </div>`
}

export function buildTodayJobsBoxHtml(todayJobCount: number, vehicleDbId: string | null): string {
  const href = buildCalendarTodayHref(vehicleDbId)
  const inner =
    todayJobCount > 0
      ? `${todayJobCount} ใบงาน`
      : "ไม่มีใบงานวันนี้"

  if (href) {
    return `
      <a href="${href}" style="display:block;margin-top:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;color:#334155;font-size:12px">
        <div style="font-weight:600;color:#475569;margin-bottom:2px">ใบงานภายในวัน</div>
        <div style="color:#0891b2;font-weight:600">${inner}</div>
      </a>`
  }

  return `
    <div style="margin-top:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px">
      <div style="font-weight:600;color:#475569;margin-bottom:2px">ใบงานภายในวัน</div>
      <div style="color:#94a3b8">${vehicleDbId ? inner : "—"}</div>
    </div>`
}
