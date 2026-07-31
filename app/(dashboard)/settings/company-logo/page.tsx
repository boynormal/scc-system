"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Check, ImageIcon, Loader2 } from "lucide-react"
import { ImageUpload } from "@/components/ui/image-upload"
import { CompanyBrandMark } from "@/components/brand/company-brand-mark"
import { GlassCard } from "@/components/glass"
import { APP_BRAND } from "@/shared/branding"

export default function CompanyLogoSettingsPage() {
  const t = useTranslations("settings")
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings/nav-preferences")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        setLogoUrl(json.data?.logoUrl ?? null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const flashSaved = () => {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1600)
  }

  const chooseLogo = async (imageUrl: string) => {
    const previous = logoUrl
    const next = imageUrl || null
    setLogoUrl(next)
    const res = await fetch("/api/settings/nav-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: next }),
    })
    if (res.ok) {
      flashSaved()
      router.refresh()
    } else {
      setLogoUrl(previous)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-white via-slate-50 to-blue-50 px-6 py-7 shadow-sm dark:border-slate-700 dark:from-slate-800 dark:via-slate-850 dark:to-blue-950/40">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-700/20" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <ImageIcon className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-white">
                {t("companyLogoTitle")}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("companyLogoDesc")}
              </p>
            </div>
          </div>
          {savedFlash && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm backdrop-blur dark:border-emerald-800 dark:bg-slate-900/70 dark:text-emerald-300">
              <Check className="h-3.5 w-3.5" />
              บันทึกแล้ว
            </span>
          )}
        </div>
      </div>

      <GlassCard className="space-y-4 rounded-2xl border-border/80 shadow-sm dark:border-slate-700">
        <div className="flex items-center gap-3">
          <CompanyBrandMark logoUrl={logoUrl} size="md" alt={APP_BRAND.name} />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-foreground">{t("companyLogoTitle")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("companyLogoDesc")}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {logoUrl ? t("companyLogoUsing") : t("companyLogoDefault")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ImageUpload
            value={logoUrl ?? undefined}
            onChange={(url) => chooseLogo(url)}
            uploadProfile="homeScreenIcon"
            assetKind="brand"
            assetId="logo"
          />
          {logoUrl ? (
            <button
              type="button"
              onClick={() => chooseLogo("")}
              className="mb-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-slate-600 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            >
              {t("companyLogoRemove")}
            </button>
          ) : null}
        </div>
      </GlassCard>
    </div>
  )
}
