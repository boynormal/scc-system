export type MetalMassUnit = "troyOz" | "metricTon" | "pound"

const TROY_OZ_KG = 31.1035 / 1000
const POUND_KG = 0.453592

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

/** Quote unit on the Investing.com metals table. Copper under 100 is the pound contract. */
export function metalMassUnit(name: string, lastUsd: number): MetalMassUnit | null {
  const normalized = normalizeName(name)
  if (
    normalized === "เงิน" ||
    normalized === "silver" ||
    normalized === "ทองคำขาว" ||
    normalized === "platinum" ||
    normalized === "พาลาเดียม" ||
    normalized === "palladium" ||
    normalized === "ทองคำ" ||
    normalized === "gold"
  ) {
    return "troyOz"
  }
  if (normalized === "ทองแดง" || normalized === "copper") {
    return lastUsd < 100 ? "pound" : "metricTon"
  }
  if (
    normalized === "ดีบุก" ||
    normalized === "tin" ||
    normalized === "นิกเกิล" ||
    normalized === "nickel" ||
    normalized === "สังกะสี" ||
    normalized === "zinc" ||
    normalized === "อะลูมิเนียม" ||
    normalized === "aluminium" ||
    normalized === "aluminum" ||
    normalized === "ตะกั่ว" ||
    normalized === "lead"
  ) {
    return "metricTon"
  }
  return null
}

/** Baht per kilogram from a USD quote and the card's baht-per-dollar rate. */
export function metalBahtPerKg(name: string, lastUsd: number, usdThb: number): number | null {
  if (!Number.isFinite(lastUsd) || lastUsd <= 0 || !Number.isFinite(usdThb) || usdThb <= 0) return null
  const unit = metalMassUnit(name, lastUsd)
  if (unit === "metricTon") return (lastUsd * usdThb) / 1000
  if (unit === "troyOz") return (lastUsd * usdThb) / TROY_OZ_KG
  if (unit === "pound") return (lastUsd * usdThb) / POUND_KG
  return null
}
