"use client"

import { useEffect, useRef } from "react"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { hasAnyAlert } from "./GpsAlertBadge"
import {
  buildGsmBarHtml,
  buildTodayJobsBoxHtml,
  formatBatteryLabel,
  formatMileageLabel,
  getMovementStatus,
  getGpsStatusColors,
} from "./gps-display-utils"

type Props = {
  vehicles: GpsVehicleData[]
  selectedId?: string | null
  onSelectVehicle?: (id: string) => void
  height?: string
}

function getMarkerColor(v: GpsVehicleData): string {
  if (!v.matchedInDb) return "#f97316"   // orange — not in DB
  if (hasAnyAlert(v.alerts)) return "#ef4444"   // red
  if (!v.online) return "#94a3b8"               // gray
  if (v.speed > 0) return "#22c55e"             // green
  if (v.engineOn) return "#f59e0b"              // amber
  return "#cbd5e1"                              // slate
}

function createCarSvg(color: string, rotation: number, size = 28): string {
  const half = size / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28">
    <g transform="rotate(${rotation} 14 14)">
      <rect x="9" y="5" width="10" height="18" rx="3" fill="${color}" stroke="white" stroke-width="1.5"/>
      <polygon points="14,2 11,7 17,7" fill="${color}" stroke="white" stroke-width="1"/>
      <rect x="10" y="7" width="3" height="4" rx="1" fill="white" opacity="0.7"/>
      <rect x="15" y="7" width="3" height="4" rx="1" fill="white" opacity="0.7"/>
    </g>
  </svg>`
}

function createMarkerHtml(
  color: string,
  rotation: number,
  plateNumber: string,
  selected: boolean,
  unmatched?: boolean
): string {
  const carSvg = createCarSvg(color, rotation, selected ? 32 : 28)
  const labelBorder = selected
    ? "border:2px solid #0891b2;"
    : unmatched
      ? "border:2px dashed #f97316;"
      : "border:1px solid #cbd5e1;"
  const labelBg = selected ? "background:#ecfeff;" : unmatched ? "background:#fff7ed;" : "background:white;"
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer">
      ${carSvg}
      <div style="${labelBg}${labelBorder}border-radius:4px;padding:1px 7px;font-size:11px;font-weight:700;color:#1e293b;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.18);font-family:sans-serif;line-height:1.4">
        ${plateNumber || "—"}
      </div>
    </div>
  `
}

export default function LeafletMapInner({ vehicles, selectedId, onSelectVehicle, height = "100%" }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map())

  useEffect(() => {
    if (typeof window === "undefined") return
    let L: typeof import("leaflet")

    async function initMap() {
      L = await import("leaflet")

      // Fix Leaflet default icon path in Next.js
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      if (!mapContainerRef.current || mapRef.current) return

      const map = L.map(mapContainerRef.current, {
        center: [13.736717, 100.523186], // Bangkok
        zoom: 10,
        zoomControl: true,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map
    }

    initMap()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current.clear()
      }
    }
  }, [])

  // Update markers when vehicles change
  useEffect(() => {
    if (!mapRef.current) return

    async function updateMarkers() {
      const L = await import("leaflet")
      const map = mapRef.current!
      const currentIds = new Set(vehicles.map((v) => v.id))

      // Remove stale markers
      for (const [id, marker] of markersRef.current.entries()) {
        if (!currentIds.has(id)) {
          marker.remove()
          markersRef.current.delete(id)
        }
      }

      // Add/update markers
      for (const vehicle of vehicles) {
        if (!vehicle.lat || !vehicle.lng) continue

        const isSelected = vehicle.id === selectedId
        const color = getMarkerColor(vehicle)
        const html = createMarkerHtml(color, vehicle.rotation, vehicle.plateNumber, isSelected, !vehicle.matchedInDb)
        const icon = L.divIcon({
          html,
          iconSize: [80, 52],
          iconAnchor: [40, 26],
          className: "",
        })

        const movement = getMovementStatus(vehicle)
        const statusColors = getGpsStatusColors(movement.label, vehicle)
        const batteryLabel = formatBatteryLabel(vehicle.battery, { short: true })
        const mileageLabel = formatMileageLabel(vehicle.mileage)
        const availBadge = vehicle.available
          ? `<span style="font-size:11px;background:#d1fae5;color:#047857;padding:2px 8px;border-radius:99px;font-weight:600">ว่าง</span>`
          : `<span style="font-size:11px;background:#ffedd5;color:#c2410c;padding:2px 8px;border-radius:99px;font-weight:600">ไม่ว่าง</span>`

        const alertLines = [
          vehicle.alerts.overSpeed ? "⚠ ความเร็วเกิน" : "",
          vehicle.alerts.offRoute ? "⚠ ออกเส้นทาง" : "",
          vehicle.alerts.overPark ? "⚠ จอดนาน" : "",
        ].filter(Boolean).join("<br/>")

        const activeJobLine = !vehicle.available && vehicle.activeJob
          ? `<div style="margin-top:6px;font-size:11px"><a href="/transport/jobs/${vehicle.activeJob.jobId}" style="color:#2563eb;font-weight:600;text-decoration:none">งานปัจจุบัน: ${vehicle.activeJob.jobNumber}</a></div>`
          : ""

        const popupContent = `
          <div style="font-family:sans-serif;min-width:240px;max-width:300px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
              <div style="font-weight:700;font-size:16px">${vehicle.plateNumber || "ไม่ระบุ"}</div>
              ${availBadge}
            </div>
            ${buildGsmBarHtml(vehicle.gsm)}
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:#475569;flex-wrap:wrap">
              <span style="font-weight:600">${vehicle.speed} km/h</span>
              <span style="font-size:11px;background:${statusColors.bg};color:${statusColors.text};padding:2px 8px;border-radius:6px;font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block" title="${movement.label.replace(/"/g, "&quot;")}">${movement.label}</span>
              ${mileageLabel ? `<span style="font-size:11px;font-weight:600;color:#334155">ไมล์ ${mileageLabel}</span>` : ""}
              ${batteryLabel ? `<span style="font-size:11px;color:#64748b">${batteryLabel}</span>` : ""}
            </div>
            ${vehicle.address ? `<div style="font-size:11px;color:#475569;margin-top:8px;line-height:1.4">📍 ${vehicle.address}</div>` : ""}
            ${vehicle.near ? `<div style="font-size:11px;color:#64748b;margin-top:2px">อยู่ที่ ${vehicle.near}</div>` : ""}
            ${buildTodayJobsBoxHtml(vehicle.todayJobCount, vehicle.vehicleDbId)}
            ${activeJobLine}
            <div style="font-size:10px;color:#94a3b8;margin-top:8px">อัปเดตล่าสุด: ${vehicle.lastUpdate || "—"}</div>
            ${alertLines ? `<div style="margin-top:6px;color:#ef4444;font-size:11px;font-weight:600">${alertLines}</div>` : ""}
          </div>
        `

        if (markersRef.current.has(vehicle.id)) {
          const marker = markersRef.current.get(vehicle.id)!
          marker.setLatLng([vehicle.lat, vehicle.lng])
          marker.setIcon(icon)
          marker.setPopupContent(popupContent)
        } else {
          const marker = L.marker([vehicle.lat, vehicle.lng], { icon })
            .addTo(map)
            .bindPopup(popupContent)

          marker.on("click", () => {
            onSelectVehicle?.(vehicle.id)
          })

          markersRef.current.set(vehicle.id, marker)
        }
      }

      // Auto-fit bounds if vehicles exist
      if (vehicles.length > 0 && markersRef.current.size > 0) {
        const validVehicles = vehicles.filter((v) => v.lat && v.lng)
        if (validVehicles.length > 0) {
          const bounds = L.latLngBounds(validVehicles.map((v) => [v.lat, v.lng]))
          if (!selectedId) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
          }
        }
      }
    }

    updateMarkers()
  }, [vehicles, onSelectVehicle, selectedId])

  // Fly to selected vehicle
  useEffect(() => {
    if (!selectedId || !mapRef.current) return
    const marker = markersRef.current.get(selectedId)
    if (marker) {
      mapRef.current.flyTo(marker.getLatLng(), 15, { duration: 1 })
      marker.openPopup()
    }
  }, [selectedId])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div
        ref={mapContainerRef}
        style={{ height, width: "100%", background: "#e8f4f8" }}
      />
    </>
  )
}
