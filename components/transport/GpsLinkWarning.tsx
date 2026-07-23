import Link from "next/link"
import { AlertTriangle } from "lucide-react"

type Props = {
  gpsDeviceId: string | null | undefined
  plateNumber?: string
  compact?: boolean
}

export function GpsLinkWarning({ gpsDeviceId, plateNumber, compact }: Props) {
  if (gpsDeviceId?.trim()) return null

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800"
      }
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium">
            {plateNumber
              ? `รถ ${plateNumber} ยังไม่มี GPS Device ID`
              : "รถคันนี้ยังไม่มี GPS Device ID"}
          </p>
          <p className="mt-0.5 text-amber-700/90">
            จะไม่แสดงบนแผนที่และผูกใบงานบน map ไม่ได้
          </p>
          <Link
            href="/transport/master-data?tab=vehicles"
            className="mt-1 inline-block font-medium text-amber-900 underline hover:text-amber-950"
          >
            เพิ่ม IMEI ใน Master Data
          </Link>
        </div>
      </div>
    </div>
  )
}
