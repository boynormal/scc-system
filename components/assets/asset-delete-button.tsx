"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

export function AssetDeleteButton({ id }: { id: string }) {
  const t = useTranslations("assets")
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    if (!window.confirm(t("deleteConfirm"))) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : json.error?.message ?? t("loadFailed"))
      return
    }
    router.push("/assets")
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" disabled={busy} onClick={() => void onDelete()}>
        {t("delete")}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
