"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { downloadPmQr } from "@/components/assets/pm-board-qr"

export function PmQrActions({
  assetId,
  assetName,
  branchName,
  typeLabel,
  dataUrl,
  canRotate,
}: {
  assetId: string
  assetName: string
  branchName: string
  typeLabel: string
  dataUrl: string | null
  canRotate: boolean
}) {
  const t = useTranslations("pmCheck")
  const assetsT = useTranslations("assets")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)

  const [downloading, setDownloading] = useState(false)

  async function onDownload() {
    if (!dataUrl) return
    setDownloading(true)
    setError(null)
    try {
      await downloadPmQr(
        { assetId, name: assetName, branchName, typeLabel, dataUrl },
        {
          branch: assetsT("branch"),
          name: assetsT("name"),
          type: assetsT("type"),
          caption: t("qrDownloadCaption"),
        }
      )
    } catch {
      setError(t("saveFailed"))
    } finally {
      setDownloading(false)
    }
  }

  async function onRotate() {
    if (!window.confirm(t("rotateConfirm"))) return
    setRotating(true)
    setError(null)
    try {
      await fetchJson(`/api/assets/${assetId}/pm/token`, { method: "POST" })
      router.refresh()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setRotating(false)
    }
  }

  return (
    <div className="space-y-3">
      {dataUrl && (
        // QR is a generated data URL, same as the transport job sticker.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="" width={180} height={180} className="mx-auto h-40 w-40 rounded-lg border border-border bg-white p-2" />
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => void onDownload()} disabled={!dataUrl} loading={downloading}>
          {t("printQr")}
        </Button>
        {canRotate && (
          <Button
            type="button"
            onClick={onRotate}
            loading={rotating}
            className="bg-slate-800 text-white hover:bg-slate-900"
          >
            {t("rotateToken")}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
