export const TIRE_WORK_TYPES = ["change", "patch", "repair"] as const
export type TireWorkType = (typeof TIRE_WORK_TYPES)[number]

export const TIRE_WORK_TYPE_LABELS: Record<TireWorkType, string> = {
  change: "เปลี่ยนยาง",
  patch: "ปะยาง",
  repair: "ซ่อมยาง",
}
