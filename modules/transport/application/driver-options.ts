export const DRIVER_LICENSE_TYPES = [
  "รถยนต์ส่วนบุคคล",
  "รถยนต์สาธารณะ",
  "รถจักรยานยนต์",
  "รถบรรทุก ชนิดที่ 1",
  "รถบรรทุก ชนิดที่ 2",
  "รถบรรทุก ชนิดที่ 3",
  "รถบรรทุก ชนิดที่ 4",
  "อื่น ๆ",
] as const

export const DRIVER_DRIVABLE_VEHICLE_TYPES = [
  "รถกระบะ",
  "รถ 6 ล้อ",
  "รถ 10 ล้อ",
  "รถเทรลเลอร์",
  "โฟล์คลิฟท์",
  "แบคโฮ",
] as const

export type DriverLicenseType = (typeof DRIVER_LICENSE_TYPES)[number]
export type DriverDrivableVehicleType = (typeof DRIVER_DRIVABLE_VEHICLE_TYPES)[number]
