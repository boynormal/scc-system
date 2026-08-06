"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { JobActionConfirmModal } from "@/components/transport/job-action-confirm-modal"

type Props = {
  jobId: string
  jobStatus: string
  compact?: boolean
}

export function ReopenJobButton({ jobId, jobStatus, compact = false }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  if (jobStatus !== "completed" && jobStatus !== "cancelled") return null

  const handleReopen = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/transport/jobs/${jobId}/reopen`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "เกิดข้อผิดพลาด")
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        disabled={loading}
        title="เปิดงานอีกครั้ง"
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            : "inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
        }
      >
        <RotateCcw className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        เปิดงานอีกครั้ง
      </button>

      <JobActionConfirmModal
        open={open}
        title="เปิดงานอีกครั้ง"
        description="เปิดงานอีกครั้งเพื่อแก้ไข? ใบงานจะกลับไปแท็บใบงานใหม่"
        confirmLabel="เปิดงานอีกครั้ง"
        cancelLabel="ปิด"
        tone="warning"
        icon={<RotateCcw className="h-5 w-5" />}
        loading={loading}
        error={error}
        onConfirm={() => void handleReopen()}
        onCancel={() => {
          if (!loading) {
            setOpen(false)
            setError(null)
          }
        }}
      />
    </>
  )
}
