"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { ChevronDown, Eye, LogOut, Pencil, Trash2 } from "lucide-react"
import { GlassDialog } from "@/components/glass"
import { cn } from "@/lib/utils"
import { exitKindLabel, PersonnelExitDialog } from "./personnel-exit-dialog"
import { HrPersonnelForm, type DepartmentOpt, type JobGroupOpt, type PersonnelFormInitial } from "./new/personnel-form"
import { formatPersonnelDateTime } from "@/modules/hr/application/personnel-date-time"

type BranchOpt = { id: string; name: string; code: string }

export type PersonnelRow = PersonnelFormInitial & {
  id: string
  departmentName: string | null
  jobGroupName: string | null
  branchLabel: string
}

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-[#0f172a] outline-none data-[highlighted]:bg-[#e2e8f0]"

const GENDER_LABEL: Record<string, string> = { MALE: "ชาย", FEMALE: "หญิง", UNSPECIFIED: "ไม่ระบุ" }
const NATIONALITY_LABEL: Record<string, string> = { THAI: "ไทย", MYANMAR: "พม่า", OTHER: "อื่นๆ" }

function shown(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "—"
}

export function PersonnelRowActions({
  person,
  branches,
  departments,
  jobGroups,
  canUpdate,
  canDelete,
}: {
  person: PersonnelRow
  branches: BranchOpt[]
  departments: DepartmentOpt[]
  jobGroups: JobGroupOpt[]
  canUpdate: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<"detail" | "edit" | "exit" | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openDialog(next: "detail" | "edit" | "exit") {
    setMenuOpen(false)
    setDialog(next)
  }

  async function onDelete() {
    if (!window.confirm("ลบรายชื่อนี้ออกจากทะเบียน? รายการจะถูกปิดใช้งานและไม่แสดงในรายการอีก")) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/hr/personnel/${person.id}`, { method: "DELETE" })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "ลบไม่สำเร็จ")
      return
    }
    setMenuOpen(false)
    router.refresh()
  }

  const fields: { label: string; value: string }[] = [
    { label: "รหัสรายชื่อ", value: person.rosterNo },
    { label: "ชื่อเรียก", value: person.displayName },
    { label: "แผนก", value: person.departmentName ?? "—" },
    { label: "กลุ่มงาน", value: person.jobGroupName ?? "—" },
    { label: "ชื่อจริง", value: person.firstName ?? "—" },
    { label: "นามสกุล", value: person.lastName ?? "—" },
    { label: "วันเกิด", value: shown(person.birthDate) },
    { label: "วันเริ่มงาน", value: formatPersonnelDateTime(person.startDate) },
    { label: "เพศ", value: person.gender ? (GENDER_LABEL[person.gender] ?? "—") : "—" },
    { label: "สัญชาติ", value: person.nationality ? (NATIONALITY_LABEL[person.nationality] ?? "—") : "—" },
    { label: "เลขบัตรประชาชน", value: person.idCardNo ?? "—" },
    { label: "โทรศัพท์", value: person.phone ?? "—" },
    { label: "ที่อยู่", value: person.address ?? "—" },
    { label: "หมายเหตุ", value: person.notes ?? "—" },
    { label: "สาขา", value: person.branchLabel },
    { label: "สถานะ", value: person.isActive ? "ใช้งาน" : "ปิด" },
    ...(person.endDate
      ? [
          { label: "วันและเวลาที่ออก", value: formatPersonnelDateTime(person.endDate) },
          { label: "เหตุที่ออก", value: exitKindLabel(person.exitKind) },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu.Root modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0f172a] disabled:opacity-50"
        >
          {busy ? "กำลังลบ…" : "จัดการ"}
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
              ดูข้อมูล
            </DropdownMenu.Item>
            {canUpdate && (
              <DropdownMenu.Item className={itemClass} onSelect={() => openDialog("edit")}>
                <Pencil className="h-3.5 w-3.5" />
                แก้ไข
              </DropdownMenu.Item>
            )}
            {canUpdate && (
              <DropdownMenu.Item className={itemClass} onSelect={() => openDialog("exit")}>
                <LogOut className="h-3.5 w-3.5" />
                บันทึกการออก
              </DropdownMenu.Item>
            )}
            {canDelete && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-[#e2e8f0]" />
                <DropdownMenu.Item
                  className={cn(itemClass, "text-red-700 data-[highlighted]:bg-red-50")}
                  onSelect={() => void onDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  ลบ
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {error && <p className="text-xs text-red-600">{error}</p>}

      <GlassDialog
        solid
        open={dialog === "detail"}
        onOpenChange={(open) => setDialog(open ? "detail" : null)}
        title={person.displayName}
      >
        <p className="font-mono text-sm text-muted-foreground">{person.rosterNo}</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {fields.map((row) => (
            <div key={row.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </GlassDialog>

      <GlassDialog
        solid
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        title="แก้ไขบุคลากร"
        className="max-w-xl"
      >
        {dialog === "edit" && (
          <HrPersonnelForm
            mode="edit"
            personnelId={person.id}
            branches={branches}
            departments={departments}
            jobGroups={jobGroups}
            initial={person}
            onSaved={() => setDialog(null)}
            onCancel={() => setDialog(null)}
          />
        )}
      </GlassDialog>

      {dialog === "exit" && (
        <PersonnelExitDialog person={person} open onOpenChange={(open) => !open && setDialog(null)} />
      )}
    </div>
  )
}
