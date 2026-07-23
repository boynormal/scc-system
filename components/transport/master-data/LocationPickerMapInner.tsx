"use client"

import { useEffect, useRef } from "react"

type Props = {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  height?: string
}

const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 }

export default function LocationPickerMapInner({
  lat,
  lng,
  onChange,
  height = "420px",
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const markerRef = useRef<import("leaflet").Marker | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return

    let cancelled = false

    async function init() {
      const L = await import("leaflet")
      if (cancelled || !mapContainerRef.current) return

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 15,
        scrollWheelZoom: true,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map)

      const marker = L.marker([lat, lng], { draggable: true }).addTo(map)
      marker.on("dragend", () => {
        const pos = marker.getLatLng()
        onChange(pos.lat, pos.lng)
      })

      map.on("click", (event) => {
        marker.setLatLng(event.latlng)
        onChange(event.latlng.lat, event.latlng.lng)
      })

      mapRef.current = map
      markerRef.current = marker
    }

    void init()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init map once
  }, [])

  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return
    markerRef.current.setLatLng([lat, lng])
    mapRef.current.panTo([lat, lng], { animate: true, duration: 0.35 })
  }, [lat, lng])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div
        ref={mapContainerRef}
        className="w-full rounded-lg border border-slate-200 overflow-hidden z-0"
        style={{ height }}
      />
    </>
  )
}

export { DEFAULT_CENTER }
