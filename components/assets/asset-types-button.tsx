"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { GlassDialog } from "@/components/glass"
import { Button } from "@/components/ui/button"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"

type AssetTypeRow = { id: string; name: string; isActive: boolean }

export function AssetTypesButton() {
  const t = useTranslations("assets")
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<AssetTypeRow[]>([])
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const json = await fetchJson<{ data: AssetTypeRow[] }>("/api/assets/types")
    setRows(json.data)
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    void load().catch((err) => setError(err instanceof ClientFetchError ? err.message : t("loadFailed")))
  }, [open, t])

  async function onAdd(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await fetchJson("/api/assets/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      setName("")
      await load()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("loadFailed"))
    } finally {
      setBusy(false)
    }
  }

  async function toggle(row: AssetTypeRow) {
    setError(null)
    try {
      await fetchJson(`/api/assets/types/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      })
      await load()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("loadFailed"))
    }
  }

  async function remove(row: AssetTypeRow) {
    if (!window.confirm(t("typeDeleteConfirm"))) return
    setError(null)
    try {
      await fetchJson(`/api/assets/types/${row.id}`, { method: "DELETE" })
      await load()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("loadFailed"))
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
      >
        {t("manageTypes")}
      </button>
      <GlassDialog open={open} onOpenChange={setOpen} title={t("manageTypes")} className="max-w-lg">
        <form onSubmit={onAdd} className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("typeName")}
            maxLength={100}
            required
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <Button type="submit" loading={busy}>
            {t("typeAdd")}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <ul className="mt-4 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.isActive ? t("typeOn") : t("typeOff")}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="bg-slate-800 text-white hover:bg-slate-900" onClick={() => void toggle(row)}>
                  {row.isActive ? t("typeTurnOff") : t("typeTurnOn")}
                </Button>
                <Button type="button" size="sm" variant="danger" onClick={() => void remove(row)}>
                  {t("delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </GlassDialog>
    </>
  )
}
