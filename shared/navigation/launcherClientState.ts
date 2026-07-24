/**
 * สถานะฝั่ง client (localStorage) ที่ใช้ร่วมกันระหว่างหน้า launcher ทุกแบบ
 * (/apps แบบการ์ด และ /app2 แบบ iPad) — ทำให้ "ปักหมุด" / "ล่าสุด" / สีไอคอนต่อโมดูล
 * ตรงกันไม่ว่าจะเปิดจากหน้าไหน
 */

const FAVORITES_KEY = "apps.launcher.favorites"
const RECENT_KEY = "apps.launcher.recent"
const USAGE_KEY = "apps.launcher.usageCounts"
const MAX_RECENT = 8

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

/** จำนวนครั้งที่แต่ละโมดูลถูกเปิด — ใช้เติม Dock ของ /app2 อัตโนมัติเมื่อปักหมุด/รายการโปรดมีไม่ครบช่อง */
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

/** ชุดสีไอคอนแบบ deterministic ต่อ moduleId — โมดูลเดียวกันได้สีเดิมเสมอในทุกหน้า launcher */
export const TILE_SKINS: TileSkin[] = [
  {
    tile: "from-orange-50 to-amber-100 ring-orange-200/70",
    icon: "from-orange-500 to-amber-400 text-white",
    blob: "bg-orange-300/45",
  },
  {
    tile: "from-teal-50 to-cyan-100 ring-teal-200/70",
    icon: "from-teal-500 to-cyan-500 text-white",
    blob: "bg-teal-300/45",
  },
  {
    tile: "from-rose-50 to-pink-100 ring-rose-200/70",
    icon: "from-rose-500 to-pink-500 text-white",
    blob: "bg-rose-300/45",
  },
  {
    tile: "from-sky-50 to-blue-100 ring-sky-200/70",
    icon: "from-sky-500 to-blue-600 text-white",
    blob: "bg-sky-300/45",
  },
  {
    tile: "from-emerald-50 to-green-100 ring-emerald-200/70",
    icon: "from-emerald-500 to-green-500 text-white",
    blob: "bg-emerald-300/45",
  },
  {
    tile: "from-violet-50 to-fuchsia-100 ring-violet-200/70",
    icon: "from-violet-500 to-fuchsia-500 text-white",
    blob: "bg-violet-300/45",
  },
]

export function skinFor(moduleId: string): TileSkin {
  const seed = moduleId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return TILE_SKINS[seed % TILE_SKINS.length]
}
