"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { useTranslations } from "next-intl"
import { GlassDialog } from "@/components/glass"
import { Button } from "@/components/ui/button"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"

type Props = {
  customer: { id: string; name: string; address: string | null; publicToken: string | null } | null
  onOpenChange: (open: boolean) => void
  onTokenChange: (customerId: string, publicToken: string) => void
}

const STICKER_FONT = "Tahoma, 'Segoe UI', sans-serif"

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("qr"))
    image.src = src
  })
}

/** Breaks text into lines that fit the sticker, so a long Thai name or address stays on the card. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const source = text.replace(/\s+/g, " ").trim()
  if (!source) return []
  const lines: string[] = []
  let current = ""
  for (const char of source) {
    const next = current + char
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current.trim())
      current = char.trim()
      if (lines.length === maxLines) break
    } else {
      current = next
    }
  }
  if (lines.length < maxLines && current.trim()) lines.push(current.trim())
  else if (current.trim()) lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/…$/, "")}…`
  return lines
}

/** Compact sticker: the shop name is the title, the address sits under it, then the QR. */
async function buildPickupSticker(opts: { qrUrl: string; name: string; address: string; caption: string }) {
  const qr = await loadImage(opts.qrUrl)
  const width = 440
  const qrSize = 268
  const textWidth = width - 72
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.font = `bold 22px ${STICKER_FONT}`
  const nameLines = wrapText(ctx, opts.name, textWidth, 2)
  ctx.font = `15px ${STICKER_FONT}`
  const addressLines = wrapText(ctx, opts.address, textWidth, 2)

  const nameHeight = nameLines.length * 28
  const addressHeight = addressLines.length > 0 ? 6 + addressLines.length * 20 : 0
  const top = 22
  const qrTop = top + nameHeight + addressHeight + 16
  canvas.width = width
  canvas.height = qrTop + qrSize + 40

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, canvas.height)
  ctx.strokeStyle = "#d1d5db"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(6, 6, width - 12, canvas.height - 12, 18)
  ctx.stroke()

  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  ctx.fillStyle = "#111827"
  ctx.font = `bold 22px ${STICKER_FONT}`
  nameLines.forEach((line, index) => ctx.fillText(line, width / 2, top + index * 28))

  ctx.fillStyle = "#4b5563"
  ctx.font = `15px ${STICKER_FONT}`
  addressLines.forEach((line, index) => {
    ctx.fillText(line, width / 2, top + nameHeight + 6 + index * 20)
  })

  ctx.drawImage(qr, (width - qrSize) / 2, qrTop, qrSize, qrSize)
  ctx.fillStyle = "#6b7280"
  ctx.font = `13px ${STICKER_FONT}`
  ctx.fillText(opts.caption, width / 2, qrTop + qrSize + 8)
  return canvas.toDataURL("image/png")
}

function pickupUrl(token: string) {
  return `${window.location.origin}/receive/${token}`
}

export function CustomerPickupQrDialog({ customer, onOpenChange, onTokenChange }: Props) {
  const t = useTranslations("pickup")
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = customer?.publicToken ?? null

  useEffect(() => {
    setCopied(false)
    setError(null)
    if (!token) {
      setDataUrl(null)
      return
    }
    const name = customer?.name ?? ""
    const address = customer?.address ?? ""
    const caption = t("qrStickerCaption")
    let cancelled = false
    void QRCode.toDataURL(pickupUrl(token), { margin: 1, width: 280 }).then(async (url) => {
      const sticker = await buildPickupSticker({ qrUrl: url, name, address, caption })
      if (!cancelled && sticker) setDataUrl(sticker)
    })
    return () => {
      cancelled = true
    }
  }, [token, customer?.name, customer?.address, t])

  async function issue() {
    if (!customer) return
    if (token && !window.confirm(t("qrReissueConfirm"))) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetchJson<{ data: { publicToken: string } }>(
        `/api/transport/master-data/customers/${customer.id}/pickup-token`,
        { method: "POST" }
      )
      onTokenChange(customer.id, res.data.publicToken)
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function copy() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(pickupUrl(token))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  function download() {
    if (!dataUrl || !customer) return
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = `pickup-qr-${customer.name.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 40) || "customer"}.png`
    link.click()
  }

  return (
    <GlassDialog open={customer !== null} onOpenChange={onOpenChange} title={t("qrTitle")} solid>
      {customer && (
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-foreground">{customer.name}</p>
            <p className="text-sm text-muted-foreground">{t("qrHint")}</p>
          </div>
          {token && dataUrl ? (
            // QR is a generated data URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt=""
              width={440}
              height={420}
              className="mx-auto h-auto w-full max-w-[280px] rounded-lg border border-border bg-white"
            />
          ) : (
            <p className="text-center text-sm text-foreground">{t("qrNone")}</p>
          )}
          {token && (
            <p className="break-all rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground">
              {pickupUrl(token)}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {token && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
                  {copied ? t("qrCopied") : t("qrCopy")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={download} disabled={!dataUrl}>
                  {t("qrDownload")}
                </Button>
                <a
                  href={`/receive/${token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  {t("qrOpen")}
                </a>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant={token ? "danger" : "primary"}
              loading={saving}
              onClick={() => void issue()}
            >
              {token ? t("qrReissue") : t("qrIssue")}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </GlassDialog>
  )
}
