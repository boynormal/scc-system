"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { GlassDialog } from "@/components/glass"
import { HrPersonnelForm, type DepartmentOpt } from "./new/personnel-form"

type BranchOpt = { id: string; name: string; code: string }

export function PersonnelCreateButton({
  branches,
  departments,
}: {
  branches: BranchOpt[]
  departments: DepartmentOpt[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1e40af]"
      >
        <Plus className="h-4 w-4" />
        เพิ่ม
      </button>
      <GlassDialog solid open={open} onOpenChange={setOpen} title="เพิ่มบุคลากร" className="max-w-xl">
        {open && (
          <HrPersonnelForm
            branches={branches}
            departments={departments}
            onSaved={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        )}
      </GlassDialog>
    </>
  )
}
