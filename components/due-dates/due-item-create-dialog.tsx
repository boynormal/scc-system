"use client"

import { useTranslations } from "next-intl"
import { GlassDialog } from "@/components/glass"
import { DueItemForm } from "./due-item-form"

export function DueItemCreateDialog({
  open,
  onOpenChange,
  onCreated,
  currentUserId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  currentUserId: string
}) {
  const t = useTranslations("dueDates")
  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title={t("newItem")} className="max-w-xl">
      <DueItemForm
        compact
        currentUserId={currentUserId}
        onCancel={() => onOpenChange(false)}
        onSaved={() => {
          onOpenChange(false)
          onCreated()
        }}
      />
    </GlassDialog>
  )
}
