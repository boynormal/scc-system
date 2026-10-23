"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { GlassDialog } from "@/components/glass"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { fmtQty } from "./fuel-format"

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("fuel")
  return (
    <div className="space-y-1.5">
      <label htmlFor="fuel-reason" className="block text-sm font-medium text-foreground">
        {t("reason")}
        <span className="ml-1 text-red-500">*</span>
      </label>
      <textarea
        id="fuel-reason"
        required
        maxLength={1000}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

export function ReverseFuelButton({ id, label }: { id: string; label: string }) {
  const t = useTranslations("fuel")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [remark, setRemark] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await fetchJson(`/api/fuel/transactions/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remark }),
      })
      setOpen(false)
      setRemark("")
      router.refresh()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("reverse")}
      </Button>
      <GlassDialog solid open={open} onOpenChange={setOpen} title={t("reverseTitle")}>
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">{t("reverseHint")}</p>
          <ReasonField value={remark} onChange={setRemark} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              {t("reverse")}
            </Button>
          </div>
        </form>
      </GlassDialog>
    </>
  )
}

export function AdjustTankButton({ tankId, currentQty, unit }: { tankId: string; currentQty: number; unit: string }) {
  const t = useTranslations("fuel")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [measured, setMeasured] = useState("")
  const [remark, setRemark] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const diff = measured === "" ? null : Math.round((Number(measured) - currentQty) * 100) / 100

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await fetchJson("/api/fuel/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "ADJUST", tankId, measuredQty: Number(measured), remark }),
      })
      setOpen(false)
      setMeasured("")
      setRemark("")
      router.refresh()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {t("adjust")}
      </Button>
      <GlassDialog solid open={open} onOpenChange={setOpen} title={t("adjustTitle")}>
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("adjustHint")}</p>
          <p className="text-sm text-foreground">
            {t("systemQty")}: <span className="font-semibold tabular-nums">{fmtQty(currentQty)}</span> {unit}
          </p>
          <Input
            label={t("measuredQty")}
            required
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={measured}
            onChange={(e) => setMeasured(e.target.value)}
          />
          {diff !== null && Number.isFinite(diff) && (
            <p className="text-sm text-foreground">
              {t("difference")}:{" "}
              <span className={diff < 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700 dark:text-emerald-400"}>
                {diff > 0 ? "+" : ""}
                {fmtQty(diff)} {unit}
              </span>
            </p>
          )}
          <ReasonField value={remark} onChange={setRemark} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={busy}>
              {t("save")}
            </Button>
          </div>
        </form>
      </GlassDialog>
    </>
  )
}
