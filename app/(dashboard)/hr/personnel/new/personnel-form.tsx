"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { GlassForm, GlassFormActions, GlassFormSection, GlassInput } from "@/components/glass"

type BranchOpt = { id: string; name: string; code: string }

export type PersonnelFormInitial = {
  rosterNo: string
  displayName: string
  firstName: string | null
  lastName: string | null
  idCardNo: string | null
  phone: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  branchId: string | null
}

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 hover:border-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-950/55"

export function HrPersonnelForm({
  branches,
  mode = "create",
  personnelId,
  initial,
}: {
  branches: BranchOpt[]
  mode?: "create" | "edit"
  personnelId?: string
  initial?: PersonnelFormInitial
}) {
  const router = useRouter()
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [rosterNo, setRosterNo] = useState(initial?.rosterNo ?? "")
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "")
  const [firstName, setFirstName] = useState(initial?.firstName ?? "")
  const [lastName, setLastName] = useState(initial?.lastName ?? "")
  const [idCardNo, setIdCardNo] = useState(initial?.idCardNo ?? "")
  const [phone, setPhone] = useState(initial?.phone ?? "")
  const [address, setAddress] = useState(initial?.address ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [branchId, setBranchId] = useState(initial?.branchId ?? branches[0]?.id ?? "")

  const hasExtra =
    Boolean(initial?.firstName || initial?.lastName || initial?.idCardNo || initial?.address || initial?.notes)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    const body = {
      ...(branchId ? (mode === "edit" ? { primaryBranchId: branchId } : { branchId }) : {}),
      ...(mode === "edit" && { rosterNo: rosterNo.trim() }),
      displayName: displayName.trim(),
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      idCardNo: idCardNo.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      ...(mode === "edit" && { isActive }),
    }
    const url = mode === "edit" && personnelId ? `/api/hr/personnel/${personnelId}` : "/api/hr/personnel"
    const res = await fetch(url, {
      method: mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr((j as { error?: string }).error ?? "บันทึกไม่สำเร็จ")
      return
    }
    const j = (await res.json().catch(() => ({}))) as { data?: { id?: string } }
    const nextId = j.data?.id ?? personnelId
    router.push(nextId ? `/hr/personnel/${nextId}` : "/hr/personnel")
    router.refresh()
  }

  return (
    <GlassForm surfaced onSubmit={onSubmit}>
      {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <GlassFormSection
        description={
          mode === "create" ? "ชื่อเรียกกับสาขาพอสำหรับบันทึก — รหัสรายชื่อสร้างให้อัตโนมัติ" : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {mode === "edit" && (
            <GlassInput
              label="รหัสรายชื่อ"
              name="rosterNo"
              required
              value={rosterNo}
              onChange={(e) => setRosterNo(e.target.value)}
              autoComplete="off"
            />
          )}
          <div className={mode === "create" ? "sm:col-span-2" : undefined}>
            <GlassInput
              label="ชื่อเรียก"
              name="displayName"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              hint="ชื่อในรายการและไฟล์ลงเวลา"
            />
          </div>
          {branches.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:col-span-2">
              ยังไม่มีสาขาในระบบ
            </p>
          ) : (
            <Select
              label="สาขา"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              options={branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))}
            />
          )}
          <GlassInput
            label="โทรศัพท์"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </GlassFormSection>

      <details className="rounded-lg border border-border px-4 py-3" open={mode === "edit" && hasExtra}>
        <summary className="cursor-pointer text-sm font-semibold text-foreground">รายละเอียดเพิ่มเติม (ไม่บังคับ)</summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassInput label="ชื่อจริง" name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <GlassInput label="นามสกุล" name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <GlassInput label="เลขบัตรประชาชน" name="idCardNo" value={idCardNo} onChange={(e) => setIdCardNo(e.target.value)} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">ที่อยู่</label>
            <textarea name="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className={fieldClass} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">หมายเหตุ</label>
            <textarea name="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} />
          </div>
          {mode === "edit" && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border"
              />
              ใช้งานในทะเบียน
            </label>
          )}
        </div>
      </details>

      <GlassFormActions>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(mode === "edit" && personnelId ? `/hr/personnel/${personnelId}` : "/hr/personnel")}
        >
          ยกเลิก
        </Button>
        <Button type="submit" disabled={loading} loading={loading}>
          {mode === "edit" ? "บันทึกการแก้ไข" : "เพิ่มบุคลากร"}
        </Button>
      </GlassFormActions>
    </GlassForm>
  )
}
