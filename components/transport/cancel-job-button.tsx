"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { XCircle } from "lucide-react"
import { JobActionConfirmModal } from "@/components/transport/job-action-confirm-modal"

type Props = {
  jobId: string
  jobStatus: string
  compact?: boolean
  variant?: "button" | "menu"
  onDialogChange?: (open: boolean) => void
}

const menuItemClass =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-red-700 outline-none data-[highlighted]:bg-muted/60"

export function CancelJobButton({
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
        <DropdownMenu.Item
          className={menuItemClass}
          onSelect={(event) => {
            event.preventDefault()
            openDialog()
          }}
        >
          <XCircle className="h-3.5 w-3.5" />
          ยกเลิก
        </DropdownMenu.Item>
      ) : (
        <button
          type="button"
          onClick={openDialog}
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
      )}

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
        onCancel={closeDialog}
      />
    </>
  )
}
