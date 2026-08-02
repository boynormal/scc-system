/** Bangkok fallback — same as `/api/weather`. */
export const WEATHER_DEFAULT_COORDS = {
  lat: 13.7563,
  lon: 100.5018,
  label: "กรุงเทพฯ (ค่าเริ่มต้น)",
} as const

/** Open Windy rain radar centered on lat/lon (external tab — not iframe). */
export function buildWindyRadarUrl(lat: number, lon: number, zoom = 8): string {
  const safeLat = Number.isFinite(lat) ? lat : WEATHER_DEFAULT_COORDS.lat
  const safeLon = Number.isFinite(lon) ? lon : WEATHER_DEFAULT_COORDS.lon
  const z = Math.min(18, Math.max(1, Math.round(zoom)))
  return `https://www.windy.com/?radar,${safeLat},${safeLon},${z}`
}
