"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { GlassForm, GlassFormActions, GlassFormSection, GlassInput } from "@/components/glass"

type BranchOpt = { id: string; name: string; code: string }
export type DepartmentOpt = { id: string; name: string; code: string | null }

export type PersonnelFormInitial = {
  rosterNo: string
  displayName: string
  jobGroup: string | null
  departmentId: string | null
  firstName: string | null
  lastName: string | null
  idCardNo: string | null
  phone: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  branchId: string | null
  birthDate?: string | null
  startDate?: string | null
  gender?: "MALE" | "FEMALE" | "UNSPECIFIED" | null
  nationality?: "THAI" | "MYANMAR" | "OTHER" | null
  endDate?: string | null
  exitKind?: "VOLUNTARY" | "INVOLUNTARY" | null
}

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 hover:border-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-950/55"

const solidField =
  "border-[#94a3b8] bg-[#ffffff] text-[#0f172a] dark:border-[#94a3b8] dark:bg-[#ffffff] backdrop-blur-none"

export function HrPersonnelForm({
  branches,
  departments,
  mode = "create",
  personnelId,
  initial,
  onSaved,
  onCancel,
}: {
  branches: BranchOpt[]
  departments: DepartmentOpt[]
  mode?: "create" | "edit"
  personnelId?: string
  initial?: PersonnelFormInitial
  onSaved?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [rosterNo, setRosterNo] = useState(initial?.rosterNo ?? "")
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "")
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? "")
  const [firstName, setFirstName] = useState(initial?.firstName ?? "")
  const [lastName, setLastName] = useState(initial?.lastName ?? "")
  const [idCardNo, setIdCardNo] = useState(initial?.idCardNo ?? "")
  const [phone, setPhone] = useState(initial?.phone ?? "")
  const [address, setAddress] = useState(initial?.address ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [branchId, setBranchId] = useState(initial?.branchId ?? branches[0]?.id ?? "")
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "")
  const [startDate, setStartDate] = useState(initial?.startDate ?? "")
  const [gender, setGender] = useState(initial?.gender ?? "")
  const [nationality, setNationality] = useState(initial?.nationality ?? "")
  const embedded = Boolean(onSaved || onCancel)
  const selectedDepartment = departments.find((department) => department.id === departmentId) ?? null

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
      departmentId: departmentId || null,
      jobGroup: selectedDepartment?.name ?? null,
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      idCardNo: idCardNo.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      birthDate: birthDate || null,
      startDate: startDate || null,
      gender: gender || null,
      nationality: nationality || null,
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
    if (onSaved) {
      onSaved()
      router.refresh()
      return
    }
    const j = (await res.json().catch(() => ({}))) as { data?: { id?: string } }
    const nextId = j.data?.id ?? personnelId
    router.push(nextId ? `/hr/personnel/${nextId}` : "/hr/personnel")
    router.refresh()
  }

  return (
    <GlassForm surfaced={!embedded} onSubmit={onSubmit}>
      {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <GlassFormSection
        description={
          mode === "create" ? "ชื่อเรียกกับสาขาพอสำหรับบันทึก — รหัสรายชื่อสร้างให้อัตโนมัติ" : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {mode === "edit" && (
            <GlassInput
              className={embedded ? solidField : undefined}
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
              className={embedded ? solidField : undefined}
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
              className={embedded ? solidField : undefined}
              label="สาขา"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              options={branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))}
            />
          )}
          <Select
            className={embedded ? solidField : undefined}
            label="กลุ่มงาน"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            placeholder={departments.length ? "ไม่ระบุ" : "ยังไม่มีแผนก"}
            options={departments.map((department) => ({
              value: department.id,
              label: department.code ? `${department.code} — ${department.name}` : department.name,
            }))}
          />
          <GlassInput
            className={embedded ? solidField : undefined}
            label="โทรศัพท์"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <GlassInput className={embedded ? solidField : undefined} label="วันเกิด" name="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          <GlassInput
            className={embedded ? solidField : undefined}
            label="วันเริ่มงาน"
            name="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            hint="วันและเวลา"
          />
          <Select
            className={embedded ? solidField : undefined}
            label="เพศ"
            value={gender}
            onChange={(e) => setGender(e.target.value as typeof gender)}
            placeholder="ยังไม่ระบุ"
            options={[
              { value: "MALE", label: "ชาย" },
              { value: "FEMALE", label: "หญิง" },
              { value: "UNSPECIFIED", label: "ไม่ระบุ" },
            ]}
          />
          <Select
            className={embedded ? solidField : undefined}
            label="สัญชาติ"
            value={nationality}
            onChange={(e) => setNationality(e.target.value as typeof nationality)}
            placeholder="ยังไม่ระบุ"
            options={[
              { value: "THAI", label: "ไทย" },
              { value: "MYANMAR", label: "พม่า" },
              { value: "OTHER", label: "อื่นๆ" },
            ]}
          />
        </div>
      </GlassFormSection>

      <details className="rounded-lg border border-border px-4 py-3" open={mode === "edit" && hasExtra}>
        <summary className="cursor-pointer text-sm font-semibold text-foreground">รายละเอียดเพิ่มเติม (ไม่บังคับ)</summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassInput className={embedded ? solidField : undefined} label="ชื่อจริง" name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <GlassInput className={embedded ? solidField : undefined} label="นามสกุล" name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <GlassInput className={embedded ? solidField : undefined} label="เลขบัตรประชาชน" name="idCardNo" value={idCardNo} onChange={(e) => setIdCardNo(e.target.value)} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">ที่อยู่</label>
            <textarea name="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className={embedded ? `${solidField} w-full rounded-lg border px-3 py-2 text-sm` : fieldClass} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">หมายเหตุ</label>
            <textarea name="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={embedded ? `${solidField} w-full rounded-lg border px-3 py-2 text-sm` : fieldClass} />
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
          className={embedded ? "border-[#334155] bg-[#1e293b] text-white hover:bg-[#0f172a] hover:text-white" : undefined}
          onClick={() => {
            if (onCancel) {
              onCancel()
              return
            }
            router.push(mode === "edit" && personnelId ? `/hr/personnel/${personnelId}` : "/hr/personnel")
          }}
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
