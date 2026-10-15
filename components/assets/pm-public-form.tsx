"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"

type Status = "pass" | "fail" | "na"

const STATUSES: Status[] = ["pass", "fail", "na"]

export function PmPublicForm({
  token,
  items,
}: {
  token: string
  items: { id: string; sequence: number; name: string }[]
}) {
  const t = useTranslations("pmCheck")
  const [choices, setChoices] = useState<Record<string, Status | "">>({})
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (items.some((item) => !choices[item.id])) {
      setError(t("needChoice"))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await fetchJson(`/api/pm/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: items.map((item) => ({
            itemId: item.id,
            status: choices[item.id],
            remark: remarks[item.id] ?? "",
          })),
        }),
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">{t("submitted")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("submittedHint")}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {items.map((item) => (
        <fieldset key={item.id} className="rounded-xl border border-border bg-card p-4">
          <legend className="px-1 text-base font-semibold text-foreground">
            {item.sequence}. {item.name}
          </legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {STATUSES.map((status) => (
              <label
                key={status}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-3 text-sm font-medium",
                  choices[item.id] === status
                    ? status === "pass"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                      : status === "fail"
                        ? "border-red-600 bg-red-50 text-red-900"
                        : "border-slate-500 bg-slate-100 text-slate-900"
                    : "border-border text-foreground"
                )}
              >
                <input
                  type="radio"
                  name={item.id}
                  value={status}
                  required={status === "pass"}
                  checked={choices[item.id] === status}
                  onChange={() => setChoices((current) => ({ ...current, [item.id]: status }))}
                />
                {t(status)}
              </label>
            ))}
          </div>
          <label className="mt-3 block text-sm text-muted-foreground">
            {t("remark")}
            <input
              value={remarks[item.id] ?? ""}
              maxLength={500}
              onChange={(event) => setRemarks((current) => ({ ...current, [item.id]: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        </fieldset>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={saving} className="w-full">
        {t("submit")}
      </Button>
    </form>
  )
}
