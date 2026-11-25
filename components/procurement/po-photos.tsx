"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Camera, ChevronLeft, ChevronRight, FileText, FolderOpen, Loader2, Trash2, X } from "lucide-react"
import { createPortal } from "react-dom"
import { fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import { attachmentSlotsLeft, MAX_PURCHASE_ATTACHMENTS } from "@/modules/procurement/application/po-rules"
import { ConfirmDialog } from "./po-confirm-dialog"
import type { PoAttachment } from "./po-client"

/** Stored so the column stays filled. The screen no longer asks the user to pick a kind. */
const STORED_KIND = "OTHER"

type Upload = { key: string; name: string; previewUrl: string | null; progress: number; error: string | null }

function uploadWithProgress(
  url: string,
  file: File,
  kind: string,
  onProgress: (pct: number) => void
): Promise<{ data: PoAttachment }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.responseType = "json"
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      const body = xhr.response as { data?: PoAttachment; error?: string | { message?: string } } | null
      if (xhr.status >= 200 && xhr.status < 300 && body?.data) return resolve({ data: body.data })
      const err = body?.error
      reject(new Error(typeof err === "string" ? err : (err?.message ?? `HTTP ${xhr.status}`)))
    }
    xhr.onerror = () => reject(new Error("network"))
    const form = new FormData()
    form.append("file", file)
    form.append("kind", kind)
    xhr.send(form)
  })
}

export function PoPhotos({
  poId,
  attachments,
  canChange,
  onChange,
  ensurePoId,
  onDraftReady,
}: {
  poId: string | null
  attachments: PoAttachment[]
  canChange: boolean
  onChange: (next: PoAttachment[]) => void
  /** Creates the draft when a file is chosen before the order has an id. Null means the form is not ready. */
  ensurePoId?: () => Promise<string | null>
  /** Called after that first save and its uploads finish, so the page can move to the new order. */
  onDraftReady?: (id: string) => void
}) {
  const t = useTranslations("procurement")
  const [uploads, setUploads] = useState<Upload[]>([])
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const [removing, setRemoving] = useState<PoAttachment | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [limitNote, setLimitNote] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const latest = useRef(attachments)
  const reserved = useRef(0)

  useEffect(() => {
    latest.current = attachments
  }, [attachments])

  async function handleFiles(files: FileList | null) {
    if (!files) return
    let id = poId
    let created = false
    let failed = false
    if (!id) {
      if (!ensurePoId) return
      try {
        id = await ensurePoId()
      } catch (err) {
        setLimitNote(err instanceof Error ? err.message : t("saveError"))
        return
      }
      if (!id) return
      created = true
    }
    try {
      const list = Array.from(files)
      const room = attachmentSlotsLeft(latest.current.length + reserved.current)
      if (room === 0) {
        setLimitNote(t("photosFull", { max: MAX_PURCHASE_ATTACHMENTS }))
        return
      }
      const kept = list.slice(0, room)
      setLimitNote(kept.length < list.length ? t("photosTrimmed", { picked: list.length, kept: kept.length }) : null)
      reserved.current += kept.length
      for (const file of kept) {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null
        setUploads((u) => [...u, { key, name: file.name, previewUrl, progress: 0, error: null }])
        try {
          const res = await uploadWithProgress(`/api/procurement/purchase-orders/${id}/files`, file, STORED_KIND, (p) =>
            setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x)))
          )
          const next = [...latest.current, res.data]
          latest.current = next
          onChange(next)
          setUploads((u) => u.filter((x) => x.key !== key))
          if (previewUrl) URL.revokeObjectURL(previewUrl)
        } catch (err) {
          failed = true
          const message = err instanceof Error && err.message !== "network" ? err.message : t("uploadFailed")
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: message } : x)))
        } finally {
          reserved.current = Math.max(0, reserved.current - 1)
        }
      }
    } finally {
      if (created && id && !failed) onDraftReady?.(id)
    }
  }

  async function confirmRemove() {
    if (!removing || !poId) return
    setRemoveBusy(true)
    setRemoveError(null)
    try {
      await fetchJson(`/api/procurement/purchase-orders/${poId}/attachments/${removing.id}`, { method: "DELETE" })
      const next = latest.current.filter((a) => a.id !== removing.id)
      latest.current = next
      onChange(next)
      setRemoving(null)
      setViewIndex(null)
      setLimitNote(null)
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : t("saveError"))
    } finally {
      setRemoveBusy(false)
    }
  }

  const hasAny = attachments.length > 0 || uploads.length > 0
  const full = attachmentSlotsLeft(attachments.length + uploads.filter((u) => !u.error).length) === 0

  return (
    <div className="space-y-3">
      {canChange ? (
        <>
          {full ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {t("photosFull", { max: MAX_PURCHASE_ATTACHMENTS })}
            </p>
          ) : null}
          {limitNote && !full ? (
            <p role="status" className="rounded-xl bg-muted px-4 py-3 text-base text-foreground">
              {limitNote}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={full}
              onClick={() => cameraRef.current?.click()}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              <Camera className="h-6 w-6" />
              {t("takePhoto")}
            </button>
            <button
              type="button"
              disabled={full}
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-border bg-background text-base font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderOpen className="h-6 w-6" />
              {t("chooseFile")}
            </button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ""
            }}
          />
        </>
      ) : null}

      {hasAny ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
          {attachments.map((a, index) => (
            <li key={a.id} className="relative">
              <button
                type="button"
                onClick={() => setViewIndex(index)}
                aria-label={`${t("viewPhoto")} ${a.fileName}`}
                className="block aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted"
              >
                {a.contentType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.fileName} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-foreground">
                    <FileText className="h-8 w-8" />
                    <span className="line-clamp-2 break-all text-xs">{a.fileName}</span>
                  </span>
                )}
              </button>
              {canChange ? (
                <button
                  type="button"
                  onClick={() => {
                    setRemoveError(null)
                    setRemoving(a)
                  }}
                  aria-label={t("removePhoto")}
                  className="absolute right-1 top-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-red-700 shadow"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              ) : null}
            </li>
          ))}
          {uploads.map((u) => (
            <li key={u.key} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
              {u.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.previewUrl} alt={u.name} className="h-full w-full object-cover opacity-60" />
              ) : null}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900/40 p-2 text-center text-white">
                {u.error ? (
                  <>
                    <span className="text-sm font-semibold">{t("uploadFailed")}</span>
                    <span className="line-clamp-2 text-xs">{u.error}</span>
                    <button
                      type="button"
                      onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}
                      className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-900"
                      aria-label={t("removePhoto")}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm font-semibold tabular-nums">{u.progress}%</span>
                  </>
                )}
              </div>
              {!u.error ? (
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/40">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${u.progress}%` }} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : canChange ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-border px-4 py-5 text-center text-foreground">
          <Camera className="h-8 w-8 text-muted-foreground/70" aria-hidden />
          <p className="text-base">{t("noPhotos")}</p>
        </div>
      ) : poId ? (
        <p className="text-base text-foreground">{t("noPhotos")}</p>
      ) : null}

      {viewIndex !== null && attachments[viewIndex] ? (
        <Lightbox
          items={attachments}
          index={viewIndex}
          onIndex={setViewIndex}
          onClose={() => setViewIndex(null)}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title={t("removePhoto")}
        message={t("removePhotoConfirm")}
        confirmLabel={t("removePhoto")}
        cancelLabel={t("keepOrder")}
        danger
        busy={removeBusy}
        error={removeError}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}

function Lightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: PoAttachment[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const t = useTranslations("procurement")
  const startX = useRef<number | null>(null)
  const item = items[index]
  const go = (delta: number) => onIndex((index + delta + items.length) % items.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length)
      if (e.key === "ArrowRight") onIndex((index + 1) % items.length)
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [index, items.length, onClose, onIndex])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.fileName}
      className="fixed inset-0 z-[90] flex flex-col bg-black/95 text-white"
      onPointerDown={(e) => {
        startX.current = e.clientX
      }}
      onPointerUp={(e) => {
        if (startX.current === null) return
        const dx = e.clientX - startX.current
        startX.current = null
        if (Math.abs(dx) > 60 && items.length > 1) go(dx < 0 ? 1 : -1)
      }}
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="min-w-0 truncate text-base">
          {t("photoCounter", { index: index + 1, total: items.length })}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
        {item.contentType.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.fileName} className="max-h-full max-w-full select-none object-contain" draggable={false} />
        ) : (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-14 items-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-slate-900"
          >
            <FileText className="h-6 w-6" />
            {t("openPdf")}
          </a>
        )}
        {items.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t("prevPhoto")}
              className={cn(
                "absolute left-2 top-1/2 inline-flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              )}
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t("nextPhoto")}
              className="absolute right-2 top-1/2 inline-flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body
  )
}
