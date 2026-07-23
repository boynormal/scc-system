"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"

type Props = {
  jobId: string
  jobStatus: string
  compact?: boolean
}

const COMPLETABLE_STATUSES = [
  "assigned", "driver_accepted", "en_route", "at_pickup",
  "loading", "departed", "at_destination", "unloading",
]

export function CompleteJobButton({ jobId, jobStatus, compact = false }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const canComplete = COMPLETABLE_STATUSES.includes(jobStatus) || jobStatus === "pending_assignment"
  if (!canComplete) return null

  const handleComplete = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/transport/jobs/${jobId}/complete`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "เกิดข้อผิดพลาด")
        setShowConfirm(false)
        return
      }
      router.refresh()
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  const startComplete = () => {
    if (compact) {
      if (window.confirm("ยืนยันจบงานนี้?")) void handleComplete()
      return
    }
    setShowConfirm(true)
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={startComplete}
          disabled={loading}
          title="จบงาน"
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {loading ? "..." : "จบงาน"}
        </button>
        {error && <p className="absolute top-full right-0 z-10 mt-1 whitespace-nowrap text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="relative">
      {!showConfirm ? (
        <button
          onClick={startComplete}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <CheckCircle2 className="h-4 w-4" />
          จบงาน
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">ยืนยันจบงานนี้?</span>
          <button
            onClick={() => void handleComplete()}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "กำลังบันทึก..." : "ยืนยัน"}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
        </div>
      )}
      {error && (
        <p className="absolute top-full mt-1 text-xs text-red-600 whitespace-nowrap">{error}</p>
      )}
    </div>
  )
}
