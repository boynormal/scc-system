"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"

type TemplateOption = {
  id: string
  name: string
  version: number
  isActive: boolean
  items: { id: string }[]
  type: { code: string } | null
}

export function ChecklistTemplatePicker(props: { value: string[]; onChange: (ids: string[]) => void }) {
  const t = useTranslations("maintenancePm")
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<{ data: TemplateOption[] }>("/api/maintenance/checklists?includeInactive=true")
      .then((json) => setTemplates(json.data))
      .catch((err) => setError(err instanceof ClientFetchError ? err.message : t("error")))
  }, [t])

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
  if (!templates) return <p className="text-sm text-muted-foreground">{t("loading")}</p>

  const visible = templates.filter((template) => template.isActive || props.value.includes(template.id))
  if (visible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("noTemplatesForPlan")}{" "}
        <Link href="/maintenance/master-data" className="text-blue-600 hover:underline">
          {t("manageTemplates")}
        </Link>
      </p>
    )
  }

  function toggle(id: string, checked: boolean) {
    props.onChange(checked ? [...props.value, id] : props.value.filter((value) => value !== id))
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {visible.map((template) => (
        <label
          key={template.id}
          className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground cursor-pointer hover:bg-muted/60"
        >
          <input
            type="checkbox"
            className="mt-0.5"
            checked={props.value.includes(template.id)}
            onChange={(e) => toggle(template.id, e.target.checked)}
          />
          <span>
            <span className="font-medium">{template.name}</span>
            <span className="block text-xs text-muted-foreground">
              {t("templateMeta", { count: template.items.length, version: template.version })}
              {template.type ? ` · ${template.type.code}` : ""}
              {!template.isActive ? ` · ${t("inactive")}` : ""}
            </span>
          </span>
        </label>
      ))}
    </div>
  )
}
