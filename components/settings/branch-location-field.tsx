"use client"

import dynamic from "next/dynamic"
import { Loader2, MapPin } from "lucide-react"
import { GlassInput } from "@/components/glass"
import {
  formatLatLng,
  googleMapsUrl,
  parseLatLngInput,
} from "@/shared/transport/coordinates"

const MAP_HEIGHT = "320px"

const LocationPickerMapInner = dynamic(
  () => import("@/components/transport/master-data/LocationPickerMapInner"),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-muted"
        style={{ height: MAP_HEIGHT }}
      >
        <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
      </div>
    ),
  }
)

type Props = {
  value: string
  onChange: (value: string) => void
}

export function BranchLocationField({ value, onChange }: Props) {
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
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 text-cyan-600" />
        พิกัดสำหรับสภาพอากาศ (ไม่บังคับ)
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <GlassInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="13.7563, 100.5018"
          className="h-8 border-cyan-300 font-mono text-xs sm:flex-1"
        />
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60"
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
        {value.trim() && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60"
          >
            ล้างพิกัด
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        ใช้แสดงอากาศบนหน้า Apps ตามสาขา — วางพิกัด หรือคลิก/ลากหมุดบนแผนที่
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

/** Parse form location string into API payload fields */
export function coordsFromLocationString(value: string): {
  latitude: number | null
  longitude: number | null
} {
  const parsed = parseLatLngInput(value)
  if (!parsed) return { latitude: null, longitude: null }
  return { latitude: parsed.lat, longitude: parsed.lng }
}
