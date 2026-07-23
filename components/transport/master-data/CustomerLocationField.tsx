"use client"

import dynamic from "next/dynamic"
import { Loader2, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  formatLatLng,
  googleMapsUrl,
  parseLatLngInput,
} from "@/shared/transport/coordinates"

const MAP_HEIGHT = "420px"

const LocationPickerMapInner = dynamic(() => import("./LocationPickerMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50"
      style={{ height: MAP_HEIGHT }}
    >
      <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
    </div>
  ),
})

type Props = {
  value: string
  onChange: (value: string) => void
}

export function CustomerLocationField({ value, onChange }: Props) {
  const parsed = parseLatLngInput(value)
  const hasLocation = parsed != null

  const applyCoordinates = (lat: number, lng: number) => {
    onChange(formatLatLng(lat, lng))
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => applyCoordinates(pos.coords.latitude, pos.coords.longitude),
      () => alert("ไม่สามารถอ่านตำแหน่งปัจจุบันได้"),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <MapPin className="h-3.5 w-3.5 text-cyan-600" />
        พิกัด / ปักหมุดบนแผนที่
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="13.610387, 100.539879"
          className="h-8 border-cyan-300 font-mono text-xs sm:flex-1"
        />
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          ใช้ตำแหน่งปัจจุบัน
        </button>
        {hasLocation && (
          <a
            href={googleMapsUrl(parsed.lat, parsed.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100"
          >
            เปิด Google Maps
          </a>
        )}
      </div>
      <p className="text-[11px] text-slate-500">
        วางค่าพิกัด เช่น 13.61038705333664, 100.53987935289308 หรือคลิก/ลากหมุดบนแผนที่
      </p>
      {value.trim() && !hasLocation && (
        <p className="text-[11px] text-amber-600">รูปแบบพิกัดไม่ถูกต้อง — ใช้ lat, lng</p>
      )}
      <LocationPickerMapInner
        lat={parsed?.lat ?? 13.7563}
        lng={parsed?.lng ?? 100.5018}
        onChange={applyCoordinates}
        height={MAP_HEIGHT}
      />
    </div>
  )
}

export function CustomerLocationDisplay({
  latitude,
  longitude,
}: {
  latitude: number | null
  longitude: number | null
}) {
  if (latitude == null || longitude == null) {
    return <span className="text-slate-400">—</span>
  }

  return (
    <div className="space-y-1">
      <p className="font-mono text-[11px] text-slate-700">{formatLatLng(latitude, longitude)}</p>
      <a
        href={googleMapsUrl(latitude, longitude)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-700 hover:underline"
      >
        <MapPin className="h-3 w-3" />
        ดูแผนที่
      </a>
    </div>
  )
}
