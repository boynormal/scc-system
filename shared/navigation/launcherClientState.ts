/**
 * สถานะฝั่ง client (localStorage) ที่ใช้ร่วมกันระหว่างหน้า launcher ทุกแบบ
 * (/apps แบบการ์ด และ /app2 แบบ iPad) — ทำให้ "ปักหมุด" / "ล่าสุด" / สีไอคอนต่อโมดูล
 * ตรงกันไม่ว่าจะเปิดจากหน้าไหน
 */

const FAVORITES_KEY = "apps.launcher.favorites"
const RECENT_KEY = "apps.launcher.recent"
const USAGE_KEY = "apps.launcher.usageCounts"
const MAX_RECENT = 8

/** Max icons shown in the /apps bottom dock (company pins + user favorites). */
export const LAUNCHER_DOCK_MAX = 8

export function getFavoriteIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

export function setFavoriteIds(ids: string[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))
}

export function getRecentIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

export function pushRecent(moduleId: string) {
  if (typeof window === "undefined") return
  const next = [moduleId, ...getRecentIds().filter((x) => x !== moduleId)].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

/** จำนวนครั้งที่แต่ละโมดูลถูกเปิด — ใช้วิเคราะห์ความถี่การใช้งานฝั่ง client */
export function getUsageCounts(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(USAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const counts: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) counts[k] = v
    }
    return counts
  } catch {
    return {}
  }
}

export function incrementUsage(moduleId: string) {
  if (typeof window === "undefined") return
  const counts = getUsageCounts()
  counts[moduleId] = (counts[moduleId] ?? 0) + 1
  localStorage.setItem(USAGE_KEY, JSON.stringify(counts))
}

/** เรียกเมื่อผู้ใช้เปิดโมดูล — อัปเดตทั้ง "ล่าสุด" และตัวนับความถี่การใช้งานไปพร้อมกัน */
export function recordAppOpen(moduleId: string) {
  pushRecent(moduleId)
  incrementUsage(moduleId)
}

export type TileSkin = { tile: string; icon: string; blob: string }

/** ชุดสีไอคอนแบบ deterministic ต่อ moduleId — สีทึบ อ่านชัดทั้งธีมสว่าง/มืด */
export const TILE_SKINS: TileSkin[] = [
  {
    tile: "from-orange-500 to-amber-600 ring-orange-700/40",
    icon: "from-orange-600 to-amber-500 text-white",
    blob: "bg-orange-500",
  },
  {
    tile: "from-teal-500 to-cyan-600 ring-teal-700/40",
    icon: "from-teal-600 to-cyan-500 text-white",
    blob: "bg-teal-500",
  },
  {
    tile: "from-rose-500 to-pink-600 ring-rose-700/40",
    icon: "from-rose-600 to-pink-500 text-white",
    blob: "bg-rose-500",
  },
  {
    tile: "from-sky-500 to-blue-600 ring-sky-700/40",
    icon: "from-sky-600 to-blue-500 text-white",
    blob: "bg-sky-500",
  },
  {
    tile: "from-emerald-500 to-green-600 ring-emerald-700/40",
    icon: "from-emerald-600 to-green-500 text-white",
    blob: "bg-emerald-500",
  },
  {
    tile: "from-violet-500 to-fuchsia-600 ring-violet-700/40",
    icon: "from-violet-600 to-fuchsia-500 text-white",
    blob: "bg-violet-500",
  },
]

export function skinFor(moduleId: string): TileSkin {
  const seed = moduleId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return TILE_SKINS[seed % TILE_SKINS.length]
}
