"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"

type GenerateResult = { data: { plans: number; schedulesCreated: number; workOrdersCreated: number } }

export function GeneratePmButton() {
  const t = useTranslations("maintenancePm")
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  async function run() {
    setPending(true)
    setMessage(null)
    try {
      const json = await fetchJson<GenerateResult>("/api/schedules/generate", { method: "POST", timeoutMs: 120_000 })
      setMessage({
        tone: "ok",
        text: t("generateDone", {
          plans: json.data.plans,
          schedules: json.data.schedulesCreated,
          workOrders: json.data.workOrdersCreated,
        }),
      })
      router.refresh()
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ClientFetchError ? err.message : t("error") })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" onClick={run} loading={pending} icon={<RefreshCw className="w-4 h-4" />}>
        {pending ? t("generating") : t("generate")}
      </Button>
      {message && (
        <p
          role="status"
          className={`text-xs ${message.tone === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
