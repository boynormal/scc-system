"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ClipboardPlus, X } from "lucide-react"
import { CreateJobForm } from "@/components/transport/CreateJobForm"

type Props = {
  open: boolean
  onSuccess: (jobId: string) => void
  onCancel: () => void
}

export function CreateJobModal({ open, onSuccess, onCancel }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onCancel])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-job-modal-title"
        className="my-4 flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardPlus className="h-4 w-4 text-cyan-600" />
              <h3 id="create-job-modal-title" className="text-sm font-semibold text-foreground">
                สร้างใบงานขนส่งใหม่
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">กรอกข้อมูลงานขนส่งและจุดแวะ</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {/* Remount form each open so state resets */}
          <CreateJobForm key="create-job" onCancel={onCancel} onSuccess={onSuccess} compact />
        </div>
      </div>
    </div>,
    document.body
  )
}
