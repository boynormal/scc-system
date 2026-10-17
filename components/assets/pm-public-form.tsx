"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"

type Status = "pass" | "fail"

const STATUSES: Status[] = ["pass", "fail"]

const choiceClass: Record<Status, { idle: string; selected: string }> = {
  pass: {
    idle: "border-[#34d399] bg-[#d1fae5] text-[#065f46]",
    selected: "border-[#047857] bg-[#059669] text-white shadow-sm",
  },
  fail: {
    idle: "border-[#fca5a5] bg-[#fee2e2] text-[#991b1b]",
    selected: "border-[#b91c1c] bg-[#dc2626] text-white shadow-sm",
  },
}

export function PmPublicForm({
  token,
  items,
  recordedAt,
}: {
  token: string
  items: { id: string; sequence: number; name: string }[]
  recordedAt?: string
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
          recordedAt,
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
      <div className="rounded-xl border border-[#6ee7b7] bg-[#d1fae5] px-5 py-10 text-center">
        <h2 className="text-lg font-semibold text-[#065f46]">{t("submitted")}</h2>
        <p className="mt-2 text-sm text-[#047857]">{t("submittedHint")}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {items.map((item) => (
        <section key={item.id} className="rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-4">
          <h2 className="flex items-center gap-3 text-base font-semibold text-[#0f172a]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-xs font-bold text-white">
              {item.sequence}
            </span>
            {item.name}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {STATUSES.map((status) => {
              const selected = choices[item.id] === status
              return (
                <label
                  key={status}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-3 py-3 text-sm font-semibold",
                    selected ? choiceClass[status].selected : choiceClass[status].idle
                  )}
                >
                  <input
                    type="radio"
                    name={item.id}
                    value={status}
                    className="sr-only"
                    checked={selected}
                    onChange={() => setChoices((current) => ({ ...current, [item.id]: status }))}
                  />
                  {t(status)}
                </label>
              )
            })}
          </div>
          <label className="mt-3 block text-sm font-medium text-[#334155]">
            {t("remark")}
            <input
              value={remarks[item.id] ?? ""}
              maxLength={500}
              onChange={(event) => setRemarks((current) => ({ ...current, [item.id]: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#94a3b8] bg-[#ffffff] px-3 py-2 text-sm font-normal text-[#0f172a]"
            />
          </label>
        </section>
      ))}
      {error && (
        <p className="rounded-lg border border-[#fecaca] bg-[#fee2e2] px-3 py-2 text-sm text-[#991b1b]">{error}</p>
      )}
      <Button
        type="submit"
        loading={saving}
        className="h-12 w-full bg-[#1e293b] text-base font-semibold text-white hover:bg-[#0f172a]"
      >
        {t("submit")}
      </Button>
    </form>
  )
}

const BANGKOK_CLOCK = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Bangkok",
})

function useBangkokClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

export function PmPublicCard({
  token,
  items,
  title,
  assetName,
  assetCode,
  statusLabel,
  statusClass,
}: {
  token: string
  items: { id: string; sequence: number; name: string }[]
  title: string
  assetName: string
  assetCode: string
  statusLabel: string
  statusClass: string
}) {
  const t = useTranslations("pmCheck")
  const now = useBangkokClock()

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-[#94a3b8] bg-[#e8eef5] shadow-md">
      <header className="bg-[#1e293b] px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-[#cbd5e1]">{title}</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">{assetName}</h1>
            <p className="mt-1 text-sm text-[#cbd5e1]">{assetCode}</p>
          </div>
          <div className="shrink-0 rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-right">
            <p className="text-[10px] font-semibold tracking-wide text-[#94a3b8]">{t("recordClock")}</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums leading-none text-white">
              {now ? BANGKOK_CLOCK.format(now) : "--:--:--"}
            </p>
          </div>
        </div>
        <p className={`mt-4 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusClass}`}>{statusLabel}</p>
      </header>
      <div className="px-4 py-4">
        <PmPublicForm token={token} items={items} recordedAt={now?.toISOString()} />
      </div>
    </div>
  )
}
