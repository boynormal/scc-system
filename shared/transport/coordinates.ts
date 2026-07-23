export type LatLng = { lat: number; lng: number }

export function parseLatLngInput(input: string): LatLng | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 2) return null

  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lat, lng }
}

export function formatLatLng(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return ""
  return `${lat}, ${lng}`
}

export function decimalToNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
