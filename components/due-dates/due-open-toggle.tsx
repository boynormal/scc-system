"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Switch } from "@/components/ui/switch"
import type { DueItemDto } from "./due-item-types"

export function DueOpenToggle({
  item,
  onUpdated,
  onFailed,
}: {
  item: DueItemDto
  onUpdated: () => void
  onFailed?: (message: string) => void
}) {
  const t = useTranslations("dueDates")
  const [busy, setBusy] = useState(false)
  const isOpen = item.status === "open"

  async function setOpen(nextOpen: boolean) {
    if (busy) return
    if (nextOpen === isOpen) return
    setBusy(true)
    const path = nextOpen ? "reopen" : "close"
    const res = await fetch(`/api/due-dates/items/${item.id}/${path}`, { method: "POST" })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      onFailed?.(typeof json.error === "string" ? json.error : t("loadFailed"))
      return
    }
    onUpdated()
  }

  return (
    <span
      className="inline-flex shrink-0 items-center"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Switch
        checked={isOpen}
        disabled={busy}
        onCheckedChange={(checked) => void setOpen(checked)}
        aria-label={isOpen ? t("toggleOn") : t("toggleOff")}
      />
    </span>
  )
}
