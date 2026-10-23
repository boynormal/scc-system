"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus } from "lucide-react"
import type { FuelTankDto } from "@/modules/fuel"
import { GlassDialog } from "@/components/glass"
import { Button } from "@/components/ui/button"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { TankForm } from "./tank-form"

type Option = { id: string; name: string }

export function TankCreateButton({ branches, fuelTypes }: { branches: Option[]; fuelTypes: Option[] }) {
  const t = useTranslations("fuel")
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
        {t("addTank")}
      </Button>
      <GlassDialog solid open={open} onOpenChange={setOpen} title={t("addTank")} className="max-w-xl">
        {open && <TankForm branches={branches} fuelTypes={fuelTypes} onDone={() => setOpen(false)} />}
      </GlassDialog>
    </>
  )
}

export function TankRowActions({
  tank,
  branches,
  fuelTypes,
  canUpdate,
  canDelete,
}: {
  tank: FuelTankDto
  branches: Option[]
  fuelTypes: Option[]
  canUpdate: boolean
  canDelete: boolean
}) {
  const t = useTranslations("fuel")
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    if (!window.confirm(t("deleteTankConfirm"))) return
    setError(null)
    try {
      await fetchJson(`/api/fuel/tanks/${tank.id}`, { method: "DELETE" })
      router.refresh()
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Link href={`/fuel/tanks/${tank.id}`}>
          <Button type="button" size="sm" variant="outline">
            {t("view")}
          </Button>
        </Link>
        {canUpdate && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t("edit")}
          </Button>
        )}
        {canDelete && tank.currentQty === 0 && (
          <Button type="button" size="sm" variant="danger" onClick={() => void onDelete()}>
            {t("delete")}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <GlassDialog solid open={editing} onOpenChange={setEditing} title={t("editTank")} className="max-w-xl">
        {editing && <TankForm tank={tank} branches={branches} fuelTypes={fuelTypes} onDone={() => setEditing(false)} />}
      </GlassDialog>
    </div>
  )
}
