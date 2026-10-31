"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus } from "lucide-react"
import { GlassDialog } from "@/components/glass/glass-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

type Option = { id: string; name: string }

export function DocCreateButton({
  categories,
  types,
}: {
  categories: Option[]
  types: Option[]
}) {
  const t = useTranslations("documentCenter")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [progress, setProgress] = useState(0)

  function close() {
    if (pending) return
    setOpen(false)
    setError(null)
    setProgress(0)
  }

  return (
    <>
      <Button type="button" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
        {t("addDocument")}
      </Button>
      <GlassDialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())} title={t("addDocument")} solid className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            const form = event.currentTarget
            const data = new FormData(form)
            const file = data.get("file")
            if (!(file instanceof File) || file.size === 0) {
              setError(t("fieldRequired"))
              return
            }
            setPending(true)
            setError(null)
            setProgress(0)
            const xhr = new XMLHttpRequest()
            xhr.open("POST", "/api/document-center/documents")
            xhr.upload.onprogress = (progressEvent) => {
              if (progressEvent.lengthComputable) {
                setProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100))
              }
            }
            xhr.onload = () => {
              setPending(false)
              if (xhr.status >= 200 && xhr.status < 300) {
                setOpen(false)
                form.reset()
                router.refresh()
                return
              }
              try {
                const body = JSON.parse(xhr.responseText) as { error?: string | { message?: string } }
                setError(typeof body.error === "string" ? body.error : body.error?.message || t("actionFailed"))
              } catch {
                setError(t("actionFailed"))
              }
            }
            xhr.onerror = () => {
              setPending(false)
              setError(t("actionFailed"))
            }
            xhr.send(data)
          }}
        >
          <Input name="documentName" label={t("name")} required maxLength={255} />
          <Select name="categoryId" label={t("category")} required defaultValue="" options={[{ value: "", label: t("category") }, ...categories.map((item) => ({ value: item.id, label: item.name }))]} />
          <Select name="typeId" label={t("type")} required defaultValue="" options={[{ value: "", label: t("type") }, ...types.map((item) => ({ value: item.id, label: item.name }))]} />
          <div className="sm:col-span-2">
            <Input name="description" label={t("description")} maxLength={4000} />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input name="requiresAcknowledgement" type="checkbox" />
            {t("requireAck")}
          </label>
          <div className="sm:col-span-2">
            <Input name="file" label={t("file")} type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc,.pptx,.ppt" />
          </div>
          {pending ? <p className="text-sm text-foreground sm:col-span-2">{t("uploadProgress")} {progress}%</p> : null}
          {error ? <p className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={close} disabled={pending}>{t("cancel")}</Button>
            <Button type="submit" loading={pending} disabled={pending}>{t("save")}</Button>
          </div>
        </form>
      </GlassDialog>
    </>
  )
}
