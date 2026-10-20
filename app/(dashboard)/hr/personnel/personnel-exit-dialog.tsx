"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GlassDialog } from "@/components/glass"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { formatPersonnelDateTime } from "@/modules/hr/application/personnel-date-time"

export type PersonnelExitKind = "VOLUNTARY" | "INVOLUNTARY"

export type PersonnelExitTarget = {
  id: string
  displayName: string
  endDate?: string | null
  exitKind?: PersonnelExitKind | null
}

const EXIT_OPTIONS = [
  { value: "VOLUNTARY", label: "สมัครใจ" },
  { value: "INVOLUNTARY", label: "ไม่ใช่สมัครใจ" },
]

export function exitKindLabel(kind: PersonnelExitKind | null | undefined): string {
  return EXIT_OPTIONS.find((option) => option.value === kind)?.label ?? "—"
}

export function PersonnelExitDialog({
  person,
  open,
  onOpenChange,
}: {
  person: PersonnelExitTarget
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [endDate, setEndDate] = useState(person.endDate ?? "")
  const [exitKind, setExitKind] = useState<PersonnelExitKind | "">(person.exitKind ?? "")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<"save" | "undo" | null>(null)
  const recorded = Boolean(person.endDate)

  async function patch(body: Record<string, unknown>, action: "save" | "undo") {
    setError(null)
    setLoading(action)
    const res = await fetch(`/api/hr/personnel/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setLoading(null)
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      setError(json.error ?? "บันทึกไม่สำเร็จ")
      return
    }
    onOpenChange(false)
    router.refresh()
  }

  function save() {
    if (!endDate || !exitKind) {
      setError("ต้องระบุวันที่ออกและเหตุที่ออก")
      return
    }
    void patch({ endDate, exitKind }, "save")
  }

  return (
    <GlassDialog solid open={open} onOpenChange={onOpenChange} title="บันทึกการออก" className="max-w-md">
      <p className="text-sm text-foreground">{person.displayName}</p>
      {recorded && (
        <p className="mt-1 text-sm text-muted-foreground">
          บันทึกไว้แล้ว {formatPersonnelDateTime(person.endDate)} · {exitKindLabel(person.exitKind)}
        </p>
      )}
      <div className="mt-4 space-y-4">
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Input
          label="วันและเวลาที่ออก"
          type="datetime-local"
          required
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          hint="ถ้าเวลานี้ผ่านไปแล้วจะปิดการใช้งานทันที"
        />
        <Select
          label="เหตุที่ออก"
          required
          value={exitKind}
          onChange={(e) => setExitKind(e.target.value as PersonnelExitKind)}
          placeholder="เลือกเหตุที่ออก"
          options={EXIT_OPTIONS}
        />
        <div className="flex flex-wrap justify-end gap-2">
          {recorded && (
            <Button
              type="button"
              variant="outline"
              disabled={loading != null}
              loading={loading === "undo"}
              onClick={() => void patch({ endDate: null, exitKind: null, isActive: true }, "undo")}
            >
              ยกเลิกการออก
            </Button>
          )}
          <Button type="button" disabled={loading != null} loading={loading === "save"} onClick={save}>
            บันทึกการออก
          </Button>
        </div>
      </div>
    </GlassDialog>
  )
}

export function PersonnelExitButton({ person }: { person: PersonnelExitTarget }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60"
      >
        บันทึกการออก
      </button>
      {open && <PersonnelExitDialog key={person.endDate ?? "new"} person={person} open={open} onOpenChange={setOpen} />}
    </>
  )
}
