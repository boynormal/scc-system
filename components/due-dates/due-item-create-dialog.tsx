"use client"

import { useTranslations } from "next-intl"
import { GlassDialog } from "@/components/glass"
import { DueItemForm } from "./due-item-form"

export function DueItemCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const t = useTranslations("dueDates")
  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title={t("newItem")} className="max-w-xl">
      <DueItemForm
        compact
        onCancel={() => onOpenChange(false)}
        onSaved={() => {
          onOpenChange(false)
          onCreated()
        }}
      />
    </GlassDialog>
  )
}
