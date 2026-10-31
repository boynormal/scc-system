"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { GlassDialog } from "@/components/glass/glass-dialog"
import { Button } from "@/components/ui/button"
import { DeleteButton } from "@/components/ui/delete-button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import type { DocListItem, DocVersionItem } from "@/modules/document_center"

type Option = { id: string; name: string }

export function DocDetailActions({
  item,
  versions,
  categories,
  types,
  canUpdate,
  canDelete,
}: {
  item: DocListItem
  versions: DocVersionItem[]
  categories: Option[]
  types: Option[]
  canUpdate: boolean
  canDelete: boolean
}) {
  const t = useTranslations("documentCenter")
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [progress, setProgress] = useState(0)

  async function saveMetadata(form: FormData) {
    setPending(true)
    setError(null)
    const res = await fetch(`/api/document-center/documents/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentName: String(form.get("documentName") || ""),
        categoryId: String(form.get("categoryId") || ""),
        typeId: String(form.get("typeId") || ""),
        description: String(form.get("description") || "") || null,
        requiresAcknowledgement: form.get("requiresAcknowledgement") === "on",
        status: String(form.get("status") || "ACTIVE"),
      }),
    })
    setPending(false)
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(body?.error || t("actionFailed"))
      return
    }
    setEditOpen(false)
    router.refresh()
  }

  function uploadVersion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const data = new FormData(form)
    setPending(true)
    setError(null)
    setProgress(0)
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `/api/document-center/documents/${item.id}/versions`)
    xhr.upload.onprogress = (progressEvent) => {
      if (progressEvent.lengthComputable) setProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100))
    }
    xhr.onload = () => {
      setPending(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        form.reset()
        router.refresh()
        return
      }
      setError(t("actionFailed"))
    }
    xhr.onerror = () => {
      setPending(false)
      setError(t("actionFailed"))
    }
    xhr.send(data)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canUpdate && !item.deletedAt ? (
          <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>{t("editMetadata")}</Button>
        ) : null}
        {canDelete && item.deletedAt ? (
          <Button
            type="button"
            onClick={async () => {
              const res = await fetch(`/api/document-center/documents/${item.id}/restore`, { method: "POST" })
              if (res.ok) router.push("/document-center")
              else setError(t("actionFailed"))
            }}
          >
            {t("restore")}
          </Button>
        ) : null}
        {canDelete && !item.deletedAt ? (
          <DeleteButton url={`/api/document-center/documents/${item.id}`} confirmMessage={t("deleteConfirm")} redirectUrl="/document-center" iconOnly={false} className="rounded-lg border border-border px-3 py-2 text-sm text-foreground" />
        ) : null}
      </div>
      {canUpdate && !item.deletedAt ? (
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={uploadVersion}>
          <div className="sm:col-span-2 text-sm font-medium text-foreground">{t("uploadVersion")}</div>
          <Input name="changeNote" label={t("changeNote")} maxLength={1000} />
          <Input name="file" label={t("file")} type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc,.pptx,.ppt" />
          {pending ? <p className="text-sm text-foreground sm:col-span-2">{t("uploadProgress")} {progress}%</p> : null}
          <div className="sm:col-span-2">
            <Button type="submit" loading={pending} disabled={pending}>{t("uploadVersion")}</Button>
          </div>
        </form>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2">
        {versions.map((version) => (
          <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
            <span>
              {t("versionLabel")} {version.versionNumber}
              {version.isCurrent ? ` · ${t("currentVersion")}` : ""}
              {version.changeNote ? ` · ${version.changeNote}` : ""}
            </span>
            <span className="flex gap-3">
              {!version.isCurrent && canUpdate && !item.deletedAt ? (
                <button
                  type="button"
                  className="underline"
                  onClick={async () => {
                    const res = await fetch(`/api/document-center/documents/${item.id}/versions/${version.id}/current`, { method: "PATCH" })
                    if (res.ok) router.refresh()
                    else setError(t("actionFailed"))
                  }}
                >
                  {t("setCurrent")}
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <GlassDialog open={editOpen} onOpenChange={setEditOpen} title={t("editMetadata")} solid className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            void saveMetadata(new FormData(event.currentTarget))
          }}
        >
          <Input name="documentName" label={t("name")} defaultValue={item.documentName} required />
          <Select name="categoryId" label={t("category")} defaultValue={item.categoryId} options={categories.map((row) => ({ value: row.id, label: row.name }))} />
          <Select name="typeId" label={t("type")} defaultValue={item.typeId} options={types.map((row) => ({ value: row.id, label: row.name }))} />
          <Select name="status" label={t("allStatuses")} defaultValue={item.status} options={[{ value: "ACTIVE", label: t("statusActive") }, { value: "INACTIVE", label: t("statusInactive") }]} />
          <div className="sm:col-span-2">
            <Input name="description" label={t("description")} defaultValue={item.description ?? ""} />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input name="requiresAcknowledgement" type="checkbox" defaultChecked={item.requiresAcknowledgement} />
            {t("requireAck")}
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" loading={pending}>{t("save")}</Button>
          </div>
        </form>
      </GlassDialog>
    </div>
  )
}
