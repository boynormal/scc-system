"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { GlassDialog } from "@/components/glass"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"

type TemplateItem = { id: string; sequence: number; name: string; detail: string | null }
type TemplateRow = { id: string; name: string; isActive: boolean; items: TemplateItem[] }
type ItemDraft = { key: string; name: string; detail: string }

const VEHICLE_STARTER: { name: string; detail: string }[] = [
  { name: "ยางรถยนต์", detail: "สภาพยาง ลมยาง และความเสียหาย" },
  { name: "น้ำมันเครื่อง", detail: "ระดับน้ำมันเครื่อง" },
  { name: "น้ำหล่อเย็น", detail: "ระดับน้ำในหม้อน้ำ/ถังพัก" },
  { name: "น้ำมันเบรก", detail: "ระดับน้ำมันเบรกและรอยรั่วที่เห็นได้" },
  { name: "ไฟส่องสว่าง", detail: "ไฟหน้า ไฟท้าย ไฟเลี้ยว และไฟเบรก" },
  { name: "ระบบเบรก", detail: "ทดสอบเบรกก่อนออกเดินทาง" },
  { name: "พวงมาลัยและแคร่", detail: "การทำงานปกติและเสียงแคร่" },
  { name: "กระจกและที่ปัดน้ำฝน", detail: "รอยแตก รอยร้าว กระจกหน้า และที่ปัดน้ำฝน" },
  { name: "สภาพตัวรถ", detail: "รอยชน ความเสียหาย และอุปกรณ์ที่โชว์" },
  { name: "อุปกรณ์ความปลอดภัย", detail: "เข็มขัดนิรภัย ถังดับเพลิง และอุปกรณ์ฉุกเฉินที่กำหนด" },
  { name: "ความพร้อมก่อนใช้งาน", detail: "น้ำมันเชื้อเพลิง และเลขไมล์ก่อนออกเดินทาง" },
]

function blankItem(): ItemDraft {
  return { key: crypto.randomUUID(), name: "", detail: "" }
}

export function PmTemplateButton({ onChanged }: { onChanged?: () => void }) {
  const t = useTranslations("pmCheck")
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [editing, setEditing] = useState<TemplateRow | "new" | null>(null)
  const [name, setName] = useState("")
  const [items, setItems] = useState<ItemDraft[]>([blankItem()])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const json = await fetchJson<{ data: TemplateRow[] }>("/api/assets/pm-templates")
    setRows(json.data)
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    void load().catch((err) => setError(err instanceof ClientFetchError ? err.message : t("loadFailed")))
  }, [open, t])

  function openEditor(template: TemplateRow | "new") {
    setEditing(template)
    setError(null)
    if (template === "new") {
      setName("")
      setItems([blankItem()])
      return
    }
    setName(template.name)
    setItems(
      template.items.map((item) => ({
        key: item.id,
        name: item.name,
        detail: item.detail ?? "",
      }))
    )
  }

  function fillStarter() {
    setName((current) => current.trim() || t("starterName"))
    setItems(VEHICLE_STARTER.map((item) => ({ key: crypto.randomUUID(), ...item })))
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const payload = {
      name,
      items: items.map((item) => ({ name: item.name, detail: item.detail })),
    }
    try {
      if (editing === "new") {
        await fetchJson("/api/assets/pm-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else if (editing) {
        await fetchJson(`/api/assets/pm-templates/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      setEditing(null)
      await load()
      onChanged?.()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setBusy(false)
    }
  }

  async function toggle(row: TemplateRow) {
    setError(null)
    try {
      await fetchJson(`/api/assets/pm-templates/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      })
      await load()
      onChanged?.()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    }
  }

  async function remove(row: TemplateRow) {
    if (!window.confirm(t("templateDeleteConfirm"))) return
    setError(null)
    try {
      await fetchJson(`/api/assets/pm-templates/${row.id}`, { method: "DELETE" })
      await load()
      onChanged?.()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEditing(null)
          setOpen(true)
        }}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
      >
        {t("manageTemplates")}
      </button>
      <GlassDialog
        solid
        open={open}
        onOpenChange={setOpen}
        title={editing ? (editing === "new" ? t("addTemplate") : t("editTemplate")) : t("manageTemplates")}
        className="max-w-3xl"
      >
        {editing ? (
          <form onSubmit={onSave} className="space-y-3">
            <Input label={t("templateName")} value={name} required maxLength={255} onChange={(event) => setName(event.target.value)} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{t("items")}</p>
              <Button type="button" size="sm" variant="outline" onClick={fillStarter}>
                {t("useStarter")}
              </Button>
            </div>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {items.map((item, index) => (
                <div key={item.key} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Input
                    id={`pm-template-name-${item.key}`}
                    label={`${t("itemName")} ${index + 1}`}
                    value={item.name}
                    required
                    maxLength={255}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row) => (row.key === item.key ? { ...row, name: event.target.value } : row))
                      )
                    }
                  />
                  <Input
                    id={`pm-template-detail-${item.key}`}
                    label={t("itemDetail")}
                    value={item.detail}
                    maxLength={255}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row) => (row.key === item.key ? { ...row, detail: event.target.value } : row))
                      )
                    }
                  />
                  {items.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}
                    >
                      {t("removeItem")}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {items.length < 50 && (
              <Button type="button" size="sm" variant="outline" onClick={() => setItems((current) => [...current, blankItem()])}>
                {t("addItem")}
              </Button>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                {t("cancel")}
              </Button>
              <Button type="submit" loading={busy}>
                {t("saveTemplate")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => openEditor("new")}>
                {t("addTemplate")}
              </Button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {rows.length === 0 ? (
              <p className="text-sm text-foreground">{t("noTemplates")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{t("templateItemCount", { count: row.items.length })}</p>
                      <p className="text-xs text-muted-foreground">{row.isActive ? t("templateOn") : t("templateOff")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEditor(row)}>
                        {t("editTemplate")}
                      </Button>
                      <Button type="button" size="sm" className="bg-slate-800 text-white hover:bg-slate-900" onClick={() => void toggle(row)}>
                        {row.isActive ? t("templateTurnOff") : t("templateTurnOn")}
                      </Button>
                      <Button type="button" size="sm" variant="danger" onClick={() => void remove(row)}>
                        {t("delete")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </GlassDialog>
    </>
  )
}
