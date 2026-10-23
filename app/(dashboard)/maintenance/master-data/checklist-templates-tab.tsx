"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { ClipboardCheck, Edit2, Plus, Trash2 } from "lucide-react"
import { GlassCard, GlassDialog } from "@/components/glass"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { Select } from "@/components/ui/select"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"

type ItemType = "checkbox" | "numeric" | "text" | "select" | "photo"

type TemplateItem = {
  id: string
  sequence: number
  section: string | null
  itemName: string
  itemType: ItemType
  standardValue: string | null
  minValue: string | null
  maxValue: string | null
  unit: string | null
  isRequired: boolean
}

type Template = {
  id: string
  name: string
  version: number
  isActive: boolean
  categoryId: string | null
  typeId: string | null
  category: { id: string; name: string } | null
  type: { id: string; name: string; code: string } | null
  items: TemplateItem[]
  _count: { planChecklistTemplates: number }
}

type Option = { id: string; name: string; code?: string | null }

type ItemDraft = {
  key: string
  section: string
  itemName: string
  itemType: ItemType
  standardValue: string
  minValue: string
  maxValue: string
  unit: string
  isRequired: boolean
}

const ITEM_TYPES: ItemType[] = ["checkbox", "numeric", "text", "select", "photo"]

function emptyItem(): ItemDraft {
  return {
    key: crypto.randomUUID(),
    section: "",
    itemName: "",
    itemType: "checkbox",
    standardValue: "",
    minValue: "",
    maxValue: "",
    unit: "",
    isRequired: true,
  }
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof ClientFetchError ? error.message : fallback
}

export function ChecklistTemplatesTab() {
  const t = useTranslations("maintenancePm")
  const [templates, setTemplates] = useState<Template[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [types, setTypes] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Template | "new" | null>(null)
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [typeId, setTypeId] = useState("")
  const [items, setItems] = useState<ItemDraft[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [list, cats, mtypes] = await Promise.all([
        fetchJson<{ data: Template[] }>("/api/maintenance/checklists?includeInactive=true"),
        fetchJson<{ data: Option[] }>("/api/master-data/categories"),
        fetchJson<{ data: Option[] }>("/api/master-data/maintenance-types"),
      ])
      setTemplates(list.data)
      setCategories(cats.data ?? [])
      setTypes(mtypes.data ?? [])
    } catch (err) {
      setError(messageOf(err, t("error")))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  function openEditor(template: Template | "new") {
    setEditing(template)
    setFormError(null)
    if (template === "new") {
      setName("")
      setCategoryId("")
      setTypeId("")
      setItems([emptyItem()])
      return
    }
    setName(template.name)
    setCategoryId(template.categoryId ?? "")
    setTypeId(template.typeId ?? "")
    setItems(
      template.items.map((item) => ({
        key: item.id,
        section: item.section ?? "",
        itemName: item.itemName,
        itemType: item.itemType,
        standardValue: item.standardValue ?? "",
        minValue: item.minValue ?? "",
        maxValue: item.maxValue ?? "",
        unit: item.unit ?? "",
        isRequired: item.isRequired,
      }))
    )
  }

  function updateItem(key: string, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  async function save() {
    if (!editing) return
    const cleaned = items.filter((item) => item.itemName.trim())
    if (!name.trim() || cleaned.length === 0) {
      setFormError(t("templateRequired"))
      return
    }
    setSaving(true)
    setFormError(null)
    const payload = {
      name: name.trim(),
      categoryId: categoryId || null,
      typeId: typeId || null,
      items: cleaned.map((item) => ({
        section: item.section,
        itemName: item.itemName,
        itemType: item.itemType,
        standardValue: item.standardValue,
        minValue: item.minValue,
        maxValue: item.maxValue,
        unit: item.unit,
        isRequired: item.isRequired,
      })),
    }
    try {
      if (editing === "new") {
        await fetchJson("/api/maintenance/checklists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        await fetchJson(`/api/maintenance/checklists/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      setEditing(null)
      await load()
    } catch (err) {
      setFormError(messageOf(err, t("error")))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(template: Template) {
    try {
      await fetchJson(`/api/maintenance/checklists/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !template.isActive }),
      })
      await load()
    } catch (err) {
      setError(messageOf(err, t("error")))
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState description={error} onRetry={load} />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => openEditor("new")} icon={<Plus className="w-4 h-4" />}>
          {t("addTemplate")}
        </Button>
      </div>
      {templates.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={t("noTemplates")} description={t("noTemplatesHint")} />
      ) : (
        <GlassCard padding="none">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground">{t("templateName")}</th>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground">{t("templateScope")}</th>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground text-center">{t("itemCount")}</th>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground text-center">{t("linkedPlans")}</th>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground text-center">{t("status")}</th>
                <th className="px-4 py-2.5 w-40"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-muted/60 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-foreground">{template.name}</p>
                    <p className="text-xs text-muted-foreground">v{template.version}</p>
                  </td>
                  <td className="px-4 py-2.5 text-foreground">
                    {[template.category?.name, template.type?.code].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-foreground">{template.items.length}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-foreground">
                    {template._count.planChecklistTemplates}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        template.isActive
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {template.isActive ? t("active") : t("inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEditor(template)} icon={<Edit2 className="w-4 h-4" />}>
                      {t("edit")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(template)}>
                      {template.isActive ? t("deactivate") : t("activate")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      <GlassDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? t("addTemplate") : t("editTemplate")}
        solid
        className="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label={t("templateName")} value={name} onChange={(e) => setName(e.target.value)} required />
            <Select label={t("category")} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t("any")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label={t("maintenanceType")} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">{t("any")}</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.code ? `${type.code} — ${type.name}` : type.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t("items")}</p>
            <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1">
              {items.map((item, index) => (
                <div key={item.key} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-12 items-end">
                  <span className="sm:col-span-12 text-xs text-muted-foreground">#{index + 1}</span>
                  <div className="sm:col-span-2">
                    <Input aria-label={t("section")} placeholder={t("section")} value={item.section} onChange={(e) => updateItem(item.key, { section: e.target.value })} />
                  </div>
                  <div className="sm:col-span-4">
                    <Input aria-label={t("itemName")} placeholder={t("itemName")} value={item.itemName} onChange={(e) => updateItem(item.key, { itemName: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Select aria-label={t("itemType")} value={item.itemType} onChange={(e) => updateItem(item.key, { itemType: e.target.value as ItemType })}>
                      {ITEM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`itemType_${type}`)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Input aria-label={t("standardValue")} placeholder={t("standardValue")} value={item.standardValue} onChange={(e) => updateItem(item.key, { standardValue: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-end gap-2">
                    <label className="flex items-center gap-1 text-xs text-foreground">
                      <input type="checkbox" checked={item.isRequired} onChange={(e) => updateItem(item.key, { isRequired: e.target.checked })} />
                      {t("required")}
                    </label>
                    <button
                      type="button"
                      aria-label={t("removeItem")}
                      onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}
                      className="p-1.5 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {item.itemType === "numeric" && (
                    <>
                      <div className="sm:col-span-2 sm:col-start-3">
                        <Input aria-label={t("minValue")} placeholder={t("minValue")} inputMode="decimal" value={item.minValue} onChange={(e) => updateItem(item.key, { minValue: e.target.value })} />
                      </div>
                      <div className="sm:col-span-2">
                        <Input aria-label={t("maxValue")} placeholder={t("maxValue")} inputMode="decimal" value={item.maxValue} onChange={(e) => updateItem(item.key, { maxValue: e.target.value })} />
                      </div>
                      <div className="sm:col-span-2">
                        <Input aria-label={t("unit")} placeholder={t("unit")} value={item.unit} onChange={(e) => updateItem(item.key, { unit: e.target.value })} />
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => setItems((current) => [...current, emptyItem()])} icon={<Plus className="w-4 h-4" />}>
              {t("addItem")}
            </Button>
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={save} loading={saving}>
              {t("save")}
            </Button>
          </div>
        </div>
      </GlassDialog>
    </div>
  )
}
