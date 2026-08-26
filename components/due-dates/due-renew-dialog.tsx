"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { GlassDialog, GlassInput } from "@/components/glass"
import type { DueItemDto } from "./due-item-types"

export function DueRenewDialog({
  item,
  open,
  onOpenChange,
  onRenewed,
}: {
  item: DueItemDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRenewed: () => void
}) {
  const t = useTranslations("dueDates")
  const tCommon = useTranslations("common")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !item) return
    setStartDate(item.startDate)
    setEndDate(item.endDate)
    setError(null)
  }, [open, item])

  async function submit() {
    if (!item) return
    if (!startDate || !endDate) {
      setError(t("renewDatesRequired"))
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/due-dates/items/${item.id}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : t("loadFailed"))
      return
    }
    onOpenChange(false)
    onRenewed()
  }

  return (
    <GlassDialog open={open} onOpenChange={onOpenChange} title={t("renew")}>
      {item && <p className="mb-4 text-sm text-muted-foreground">{item.title}</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <GlassInput
          id="renew-start-date"
          label={t("startDate")}
          type="date"
          required
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <GlassInput
          id="renew-end-date"
          label={t("endDate")}
          type="date"
          required
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          {tCommon("cancel")}
        </Button>
        <Button type="button" loading={busy} onClick={() => void submit()}>
          {t("renew")}
        </Button>
      </div>
    </GlassDialog>
  )
}
