/** WMO weather interpretation codes → Thai label */
export function weatherLabelTh(code: number): string {
  if (code === 0) return "ท้องฟ้าแจ่มใส"
  if (code === 1) return "ส่วนใหญ่แจ่มใส"
  if (code === 2) return "มีเมฆบางส่วน"
  if (code === 3) return "เมฆมาก"
  if (code === 45 || code === 48) return "มีหมอก"
  if (code >= 51 && code <= 57) return "ฝนปรอย"
  if (code >= 61 && code <= 67) return "ฝนตก"
  if (code >= 71 && code <= 77) return "หิมะ"
  if (code >= 80 && code <= 82) return "ฝนตกหนักเป็นช่วง"
  if (code >= 85 && code <= 86) return "หิมะเป็นช่วง"
  if (code === 95) return "พายุฝนฟ้าคะนอง"
  if (code === 96 || code === 99) return "พายุลูกเห็บ"
  return "สภาพอากาศทั่วไป"
}

export type WeatherPayload = {
  temperature: number
  apparentTemperature: number
  humidity: number
  weatherCode: number
  label: string
  locationName: string
  isDay: boolean
  updatedAt: string
}
