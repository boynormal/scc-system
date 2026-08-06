"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { XCircle } from "lucide-react"
import { JobActionConfirmModal } from "@/components/transport/job-action-confirm-modal"

type Props = {
  jobId: string
  jobStatus: string
  compact?: boolean
}

export function CancelJobButton({ jobId, jobStatus, compact = false }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  if (jobStatus === "completed" || jobStatus === "cancelled") return null

  const handleCancel = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/transport/jobs/${jobId}`, { method: "DELETE" })
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
        title="ยกเลิกใบงาน"
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            : "inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
        }
      >
        <XCircle className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {compact ? "ยกเลิก" : "ยกเลิกใบงาน"}
      </button>

      <JobActionConfirmModal
        open={open}
        title="ยกเลิกใบงาน"
        description="ยืนยันยกเลิกใบงานนี้? ใบงานจะย้ายไปแท็บใบงานยกเลิก"
        confirmLabel="ยกเลิกใบงาน"
        cancelLabel="ปิด"
        tone="danger"
        icon={<XCircle className="h-5 w-5" />}
        loading={loading}
        error={error}
        onConfirm={() => void handleCancel()}
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
