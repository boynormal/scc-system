"use client"

import { GlassDialog } from "@/components/glass/glass-dialog"
import { Button } from "@/components/ui/button"

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  busy,
  error,
  children,
  confirmDisabled,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  busy?: boolean
  error?: string | null
  children?: React.ReactNode
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <GlassDialog open={open} onOpenChange={(next) => !next && !busy && onCancel()} title={title} solid>
      <div className="space-y-4">
        {message ? <p className="text-base text-foreground">{message}</p> : null}
        {children}
        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-base text-red-700">{error}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-14 text-base" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            className="h-14 text-base font-semibold"
            loading={busy}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </GlassDialog>
  )
}
