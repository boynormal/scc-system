import { NextRequest, NextResponse } from "next/server"
import { weatherLabelTh, type WeatherPayload } from "@/shared/weather"

const BANGKOK = { lat: 13.7563, lon: 100.5018, name: "กรุงเทพฯ" }

async function reversePlaceName(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=th`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      city?: string
      locality?: string
      principalSubdivision?: string
    }
    return data.city || data.locality || data.principalSubdivision || null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const latRaw = sp.get("lat")
  const lonRaw = sp.get("lon")
  const lat = latRaw != null ? Number(latRaw) : NaN
  const lon = lonRaw != null ? Number(lonRaw) : NaN
  const useGeo = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  const coords = useGeo ? { lat, lon } : { lat: BANGKOK.lat, lon: BANGKOK.lon }

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast")
    url.searchParams.set("latitude", String(coords.lat))
    url.searchParams.set("longitude", String(coords.lon))
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day"
    )
    url.searchParams.set("timezone", "Asia/Bangkok")

    const weatherRes = await fetch(url.toString(), { next: { revalidate: 600 } })
    if (!weatherRes.ok) {
      return NextResponse.json({ error: "ไม่สามารถดึงข้อมูลอากาศได้" }, { status: 502 })
    }

    const json = (await weatherRes.json()) as {
      current?: {
        temperature_2m?: number
        relative_humidity_2m?: number
        apparent_temperature?: number
        weather_code?: number
        is_day?: number
      }
    }

    const current = json.current
    if (!current || current.temperature_2m == null || current.weather_code == null) {
      return NextResponse.json({ error: "ข้อมูลอากาศไม่ครบ" }, { status: 502 })
    }

    const place =
      (useGeo ? await reversePlaceName(coords.lat, coords.lon) : null) ??
      (useGeo ? "ตำแหน่งของคุณ" : BANGKOK.name)

    const payload: WeatherPayload = {
      temperature: Math.round(current.temperature_2m),
      apparentTemperature: Math.round(current.apparent_temperature ?? current.temperature_2m),
      humidity: Math.round(current.relative_humidity_2m ?? 0),
      weatherCode: current.weather_code,
      label: weatherLabelTh(current.weather_code),
      locationName: place,
      isDay: current.is_day === 1,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" },
    })
  } catch (error) {
    console.error("[weather]", error)
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงอากาศ" }, { status: 500 })
  }
}
