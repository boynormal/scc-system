"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { ChevronDown, ClipboardList, Eye, Pencil, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { GlassDialog } from "@/components/glass"
import { cn } from "@/lib/utils"
import { AssetForm } from "./asset-form"
import type { AssetDto } from "./asset-types"

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-[#0f172a] outline-none data-[highlighted]:bg-[#e2e8f0]"

export function AssetRowActions({
  asset,
  canUpdate,
  canDelete,
}: {
  asset: AssetDto
  canUpdate: boolean
  canDelete: boolean
}) {
  const t = useTranslations("assets")
  const pm = useTranslations("pmCheck")
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<"detail" | "edit" | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows: { label: string; value: string }[] = [
    { label: t("code"), value: asset.code },
    { label: t("name"), value: asset.name },
    { label: t("type"), value: asset.typeName },
    { label: t("ownership"), value: t(`own_${asset.ownership}`) },
    { label: t("status"), value: t(`st_${asset.status}`) },
    { label: t("branch"), value: asset.branchName },
    { label: t("serialNumber"), value: asset.serialNumber ?? "—" },
    { label: t("details"), value: asset.details ?? "—" },
    { label: t("acquiredAt"), value: asset.acquiredAt ?? "—" },
  ]

  function openDialog(next: "detail" | "edit") {
    setMenuOpen(false)
    setDialog(next)
  }

  async function onDelete() {
    if (!window.confirm(t("deleteConfirm"))) return
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" })
    const json = await res.json().catch(() => ({}))
    setDeleting(false)
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : json.error?.message ?? t("loadFailed"))
      return
    }
    setMenuOpen(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end">
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger
          className="inline-flex items-center gap-1 rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0f172a]"
        >
          {t("manage")}
          <ChevronDown className="h-3.5 w-3.5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-[11rem] rounded-lg border border-[#cbd5e1] bg-[#ffffff] p-1 shadow-lg"
          >
            <DropdownMenu.Item className={itemClass} onSelect={() => openDialog("detail")}>
              <Eye className="h-3.5 w-3.5" />
              {t("viewDetail")}
            </DropdownMenu.Item>
            {canUpdate && (
              <DropdownMenu.Item className={itemClass} onSelect={() => openDialog("edit")}>
                <Pencil className="h-3.5 w-3.5" />
                {t("editData")}
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item asChild>
              <Link href={`/assets/${asset.id}/pm`} className={itemClass}>
                <ClipboardList className="h-3.5 w-3.5" />
                {pm("openPm")}
              </Link>
            </DropdownMenu.Item>
            {canDelete && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  className={cn(itemClass, "text-red-600 data-[highlighted]:text-red-700")}
                  disabled={deleting}
                  onSelect={(event) => {
                    event.preventDefault()
                    void onDelete()
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("delete")}
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <GlassDialog
        solid
        open={dialog === "detail"}
        onOpenChange={(open) => setDialog(open ? "detail" : null)}
        title={t("detailTitle")}
      >
        <p className="text-sm text-muted-foreground">{asset.code}</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</dt>
              <dd className="mt-1 text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </GlassDialog>

      <GlassDialog
        solid
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        title={t("editData")}
        className="max-w-xl"
      >
        {dialog === "edit" && (
          <AssetForm asset={asset} onSaved={() => setDialog(null)} onCancel={() => setDialog(null)} />
        )}
      </GlassDialog>
    </div>
  )
}
