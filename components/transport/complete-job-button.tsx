"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { CheckCircle2 } from "lucide-react"
import { JobActionConfirmModal } from "@/components/transport/job-action-confirm-modal"

type Props = {
  jobId: string
  jobStatus: string
  compact?: boolean
  variant?: "button" | "menu"
  onDialogChange?: (open: boolean) => void
}

const COMPLETABLE_STATUSES = [
  "assigned", "driver_accepted", "en_route", "at_pickup",
  "loading", "departed", "at_destination", "unloading", "pending_review",
]

const menuItemClass =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-emerald-700 outline-none data-[highlighted]:bg-muted/60"

export function CompleteJobButton({
  jobId,
  jobStatus,
  compact = false,
  variant = "button",
  onDialogChange,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

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
        return
      }
      setOpen(false)
      onDialogChange?.(false)
      router.refresh()
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setLoading(false)
    }
  }

  const openDialog = () => {
    setError(null)
    setOpen(true)
    onDialogChange?.(true)
  }

  const closeDialog = () => {
    if (loading) return
    setOpen(false)
    setError(null)
    onDialogChange?.(false)
  }

  return (
    <>
      {variant === "menu" ? (
        <DropdownMenu.Item className={menuItemClass} onSelect={(event) => {
          event.preventDefault()
          openDialog()
        }}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          จบงาน
        </DropdownMenu.Item>
      ) : (
        <button
          type="button"
          onClick={openDialog}
          disabled={loading}
          title="จบงาน"
          className={
            compact
              ? "inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              : "inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          }
        >
          <CheckCircle2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          จบงาน
        </button>
      )}

      <JobActionConfirmModal
        open={open}
        title="จบงาน"
        description="ยืนยันจบงานนี้? ใบงานจะย้ายไปแท็บใบงานเสร็จสิ้น"
        confirmLabel="จบงาน"
        cancelLabel="ปิด"
        tone="success"
        icon={<CheckCircle2 className="h-5 w-5" />}
        loading={loading}
        error={error}
        onConfirm={() => void handleComplete()}
        onCancel={closeDialog}
      />
    </>
  )
}
