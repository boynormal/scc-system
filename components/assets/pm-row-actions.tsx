"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { ChevronDown, ClipboardList, Power, QrCode } from "lucide-react"
import { useTranslations } from "next-intl"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { downloadPmQr, type PmQrSticker } from "@/components/assets/pm-board-qr"
import { cn } from "@/lib/utils"

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-[#0f172a] outline-none data-[highlighted]:bg-[#e2e8f0]"

export function PmRowActions({ sticker, canUpdate }: { sticker: PmQrSticker; canUpdate: boolean }) {
  const t = useTranslations("assets")
  const pm = useTranslations("pmCheck")
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDeactivate() {
    if (!window.confirm(pm("deactivateConfirm"))) return
    setBusy(true)
    setError(null)
    try {
      await fetchJson(`/api/assets/${sticker.assetId}/pm/deactivate`, { method: "POST" })
      setMenuOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : pm("saveFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900">
          {t("manage")}
          <ChevronDown className="h-4 w-4" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-[11rem] rounded-lg border border-[#cbd5e1] bg-[#ffffff] p-1 shadow-lg"
          >
            <DropdownMenu.Item
              className={itemClass}
              disabled={!sticker.dataUrl}
              onSelect={() =>
                void downloadPmQr(sticker, {
                  branch: t("branch"),
                  name: t("name"),
                  type: t("type"),
                  caption: pm("qrDownloadCaption"),
                })
              }
            >
              <QrCode className="h-3.5 w-3.5" />
              {pm("issueQr")}
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild>
              <Link href={`/assets/${sticker.assetId}/pm`} className={itemClass}>
                <ClipboardList className="h-3.5 w-3.5" />
                {pm("openPm")}
              </Link>
            </DropdownMenu.Item>
            {canUpdate && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-[#e2e8f0]" />
                <DropdownMenu.Item
                  className={cn(itemClass, "text-red-700 data-[highlighted]:bg-red-50")}
                  disabled={busy}
                  onSelect={(event) => {
                    event.preventDefault()
                    void onDeactivate()
                  }}
                >
                  <Power className="h-3.5 w-3.5" />
                  {pm("deactivate")}
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
