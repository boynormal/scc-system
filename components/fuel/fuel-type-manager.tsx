"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Fuel, Plus } from "lucide-react"
import type { FuelTypeDto } from "@/modules/fuel"
import { GlassDialog } from "@/components/glass"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { ListFrame } from "@/components/shell/list-frame"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"

type Draft = { id?: string; code?: string; name: string }

export function FuelTypeManager({
  rows,
  canCreate,
  canUpdate,
  canDelete,
}: {
  rows: FuelTypeDto[]
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}) {
  const t = useTranslations("fuel")
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  function errorText(err: unknown) {
    return err instanceof ClientFetchError ? err.message : t("saveFailed")
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault()
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      await fetchJson(draft.id ? `/api/fuel/types/${draft.id}` : "/api/fuel/types", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name }),
      })
      setDraft(null)
      router.refresh()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function toggle(row: FuelTypeDto) {
    setRowError(null)
    try {
      await fetchJson(`/api/fuel/types/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      })
      router.refresh()
    } catch (err) {
      setRowError(errorText(err))
    }
  }

  async function remove(row: FuelTypeDto) {
    if (!window.confirm(t("deleteTypeConfirm"))) return
    setRowError(null)
    try {
      await fetchJson(`/api/fuel/types/${row.id}`, { method: "DELETE" })
      router.refresh()
    } catch (err) {
      setRowError(errorText(err))
    }
  }

  const addButton = canCreate ? (
    <Button type="button" icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ name: "" })}>
      {t("addType")}
    </Button>
  ) : null

  return (
    <ListFrame title={t("typesTitle")} description={t("typesDesc")} actions={addButton} plainPanel>
      <AppDataTablePanel>
        {rowError && <p className="px-4 pt-3 text-sm text-red-600">{rowError}</p>}
        {rows.length === 0 ? (
          <EmptyState icon={Fuel} title={t("noTypes")} description={t("noTypesHint")} action={addButton} />
        ) : (
          <AppDataTable>
            <AppDataTableHead>
              <tr>
                <th>{t("typeCode")}</th>
                <th>{t("typeName")}</th>
                <th className="text-right">{t("tankCount")}</th>
                <th>{t("status")}</th>
                <th className="text-right">{t("manage")}</th>
              </tr>
            </AppDataTableHead>
            <AppDataTableBody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-semibold">{row.code}</td>
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3 text-right">{row.tankCount}</td>
                  <td className="px-4 py-3">
                    <Badge variant={row.isActive ? "success" : "default"}>{row.isActive ? t("active") : t("inactive")}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraft({ id: row.id, code: row.code, name: row.name })}
                          >
                            {t("edit")}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void toggle(row)}>
                            {row.isActive ? t("turnOff") : t("turnOn")}
                          </Button>
                        </>
                      )}
                      {canDelete && row.tankCount === 0 && (
                        <Button type="button" size="sm" variant="danger" onClick={() => void remove(row)}>
                          {t("delete")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </AppDataTableBody>
          </AppDataTable>
        )}
      </AppDataTablePanel>

      <GlassDialog
        solid
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
        title={draft?.id ? t("editType") : t("addType")}
      >
        {draft && (
          <form onSubmit={onSave} className="space-y-3">
            <p className="text-sm text-foreground">
              {t("typeCode")}: <span className="font-semibold">{draft.code ?? t("autoCode")}</span>
            </p>
            <Input
              label={t("typeName")}
              required
              maxLength={100}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                {t("cancel")}
              </Button>
              <Button type="submit" loading={busy}>
                {t("save")}
              </Button>
            </div>
          </form>
        )}
      </GlassDialog>
    </ListFrame>
  )
}
