import type { GpsVehicleData } from "@/modules/transport/application/gps-service"

export function getAvailabilityLabel(v: Pick<GpsVehicleData, "available" | "vehicleDbStatus" | "activeJob">): {
  label: string
  className: string
  popupStyle: string
} {
  if (v.vehicleDbStatus === "maintenance") {
    return {
      label: "ซ่อมบำรุง",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
      popupStyle: "font-size:11px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:99px;font-weight:600",
    }
  }
  if (v.vehicleDbStatus === "inactive") {
    return {
      label: "ไม่ใช้งาน",
      className: "bg-muted text-muted-foreground",
      popupStyle: "font-size:11px;background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:99px;font-weight:600",
    }
  }
  if (v.available) {
    return {
      label: "ว่าง",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
      popupStyle: "font-size:11px;background:#d1fae5;color:#047857;padding:2px 8px;border-radius:99px;font-weight:600",
    }
  }
  return {
    label: v.activeJob ? "ไม่ว่าง" : "ไม่ว่าง",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
    popupStyle: "font-size:11px;background:#ffedd5;color:#c2410c;padding:2px 8px;border-radius:99px;font-weight:600",
  }
}
