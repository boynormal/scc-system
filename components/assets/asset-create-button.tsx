"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { GlassDialog } from "@/components/glass"
import { AssetForm } from "./asset-form"

export function AssetCreateButton({ className }: { className?: string }) {
  const t = useTranslations("assets")
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        }
      >
        <Plus className="h-4 w-4" />
        {t("newAsset")}
      </button>
      <GlassDialog solid open={open} onOpenChange={setOpen} title={t("newAsset")} className="max-w-xl">
        {open && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("codeHint")}</p>
            <AssetForm onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
          </div>
        )}
      </GlassDialog>
    </>
  )
}
