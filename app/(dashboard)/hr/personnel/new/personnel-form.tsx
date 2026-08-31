"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { GlassForm, GlassFormActions, GlassFormSection, GlassInput } from "@/components/glass"

type BranchOpt = { id: string; name: string; code: string }
type UserOpt = { id: string; firstName: string; lastName: string; username: string; email: string }
type DeptOpt = { id: string; name: string; code: string | null; branchId: string }
type PositionOpt = { id: string; name: string; code: string | null; depth: number; branchId: string }

export type PersonnelFormInitial = {
  rosterNo: string
  displayName: string
  jobGroup: string | null
  firstName: string | null
  lastName: string | null
  idCardNo: string | null
  phone: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  userId: string | null
  departmentId: string | null
  positionId: string | null
  branchIds: string[]
  primaryBranchId: string | null
}

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 hover:border-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-950/55"

export function HrPersonnelForm({
  branches,
  users,
  mode = "create",
  personnelId,
  initial,
}: {
  branches: BranchOpt[]
  users: UserOpt[]
  mode?: "create" | "edit"
  personnelId?: string
  initial?: PersonnelFormInitial
}) {
  const router = useRouter()
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [userId, setUserId] = useState(initial?.userId ?? "")
  const [rosterNo, setRosterNo] = useState(initial?.rosterNo ?? "")
  const [suggesting, setSuggesting] = useState(false)
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "")
  const [jobGroup, setJobGroup] = useState(initial?.jobGroup ?? "")
  const [firstName, setFirstName] = useState(initial?.firstName ?? "")
  const [lastName, setLastName] = useState(initial?.lastName ?? "")
  const [idCardNo, setIdCardNo] = useState(initial?.idCardNo ?? "")
  const [phone, setPhone] = useState(initial?.phone ?? "")
  const [address, setAddress] = useState(initial?.address ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? "")
  const [departments, setDepartments] = useState<DeptOpt[]>([])
  const [positionId, setPositionId] = useState(initial?.positionId ?? "")
  const [positions, setPositions] = useState<PositionOpt[]>([])
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(() => {
    if (initial?.branchIds.length) return initial.branchIds
    return branches[0]?.id ? [branches[0].id] : []
  })
  const [primaryBranchId, setPrimaryBranchId] = useState<string | null>(
    () => initial?.primaryBranchId ?? branches[0]?.id ?? null
  )

  const selectedSet = useMemo(() => new Set(selectedBranchIds), [selectedBranchIds])
  const hasExtra =
    Boolean(initial?.firstName || initial?.lastName || initial?.idCardNo || initial?.address || initial?.notes || initial?.userId)

  useEffect(() => {
    if (selectedBranchIds.length === 0) {
      setPrimaryBranchId(null)
      return
    }
    if (!primaryBranchId || !selectedBranchIds.includes(primaryBranchId)) {
      setPrimaryBranchId(selectedBranchIds[0]!)
    }
  }, [selectedBranchIds, primaryBranchId])

  useEffect(() => {
    if (selectedBranchIds.length === 0) {
      setDepartments([])
      setDepartmentId("")
      return
    }
    const qs = selectedBranchIds.map((id) => `branchId=${encodeURIComponent(id)}`).join("&")
    void fetch(`/api/hr/personnel/department-options?${qs}`)
      .then((r) => r.json())
      .then((json) => {
        const rows = (json.data ?? []) as DeptOpt[]
        setDepartments(rows)
        setDepartmentId((prev) => (prev && rows.some((d) => d.id === prev) ? prev : ""))
      })
  }, [selectedBranchIds])

  useEffect(() => {
    if (selectedBranchIds.length === 0) {
      setPositions([])
      setPositionId("")
      return
    }
    const qs = selectedBranchIds.map((id) => `branchId=${encodeURIComponent(id)}`).join("&")
    void fetch(`/api/hr/personnel/position-options?${qs}`)
      .then((r) => r.json())
      .then((json) => {
        const rows = (json.data ?? []) as PositionOpt[]
        setPositions(rows)
        setPositionId((prev) => (prev && rows.some((p) => p.id === prev) ? prev : ""))
      })
  }, [selectedBranchIds])

  async function suggestRoster(force = false) {
    if (mode !== "create") return
    if (!force && rosterNo.trim()) return
    setSuggesting(true)
    const res = await fetch("/api/hr/personnel/next-roster")
    const json = (await res.json().catch(() => ({}))) as { data?: { rosterNo?: string }; error?: string }
    setSuggesting(false)
    if (res.ok && json.data?.rosterNo) {
      setRosterNo(json.data.rosterNo)
      return
    }
    if (force) setErr(typeof json.error === "string" ? json.error : "แนะนำรหัสไม่สำเร็จ")
  }

  useEffect(() => {
    if (mode !== "create") return
    void suggestRoster(false)
    // Fill once on create mount; user can still edit or tap แนะนำรหัส.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function toggleBranch(id: string) {
    setSelectedBranchIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return [...next]
    })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    const body = {
      branchIds: selectedBranchIds,
      primaryBranchId:
        primaryBranchId && selectedSet.has(primaryBranchId) ? primaryBranchId : selectedBranchIds[0] ?? undefined,
      rosterNo: rosterNo.trim(),
      displayName: displayName.trim(),
      jobGroup: jobGroup.trim() || null,
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      idCardNo: idCardNo.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      isActive,
      userId: userId || null,
      departmentId: departmentId || null,
      positionId: positionId || null,
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

      <GlassFormSection title="ข้อมูลหลัก" description="กรอกสองช่องนี้ก็บันทึกได้ — รหัสจะแนะนำให้อัตโนมัติ">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,11rem)_1fr]">
          <div className="space-y-1.5">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <GlassInput
                  label="รหัสรายชื่อ"
                  name="rosterNo"
                  required
                  value={rosterNo}
                  onChange={(e) => setRosterNo(e.target.value)}
                  autoComplete="off"
                />
              </div>
              {mode === "create" && (
                <Button type="button" variant="outline" disabled={suggesting} onClick={() => void suggestRoster(true)}>
                  {suggesting ? "…" : "แนะนำ"}
                </Button>
              )}
            </div>
            {mode === "create" && (
              <p className="text-xs text-muted-foreground">ใช้ทั้งบริษัท ไม่ผูกสาขา — แก้ได้ถ้าเครื่องลงเวลามีรหัสอยู่แล้ว</p>
            )}
          </div>
          <GlassInput
            label="ชื่อแสดง"
            name="displayName"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            hint="ชื่อในรายการและไฟล์ลงเวลา"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <GlassInput
            label="กลุ่มงาน"
            name="jobGroup"
            value={jobGroup}
            onChange={(e) => setJobGroup(e.target.value)}
            placeholder="เช่น ผลิต, สำนักงาน"
          />
          <GlassInput
            label="โทรศัพท์"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </GlassFormSection>

      <GlassFormSection title="สาขาที่ลงเวลาได้" description="เลือกได้หลายสาขา — กด «หลัก» เมื่อมีมากกว่าหนึ่ง">
        {branches.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">ยังไม่มีสาขาในระบบ</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => {
              const selected = selectedSet.has(b.id)
              const isPrimary = selected && primaryBranchId === b.id
              return (
                <div
                  key={b.id}
                  className={`inline-flex items-center overflow-hidden rounded-lg border text-sm ${
                    selected
                      ? "border-blue-300 bg-blue-50 text-blue-900"
                      : "border-border bg-background text-foreground hover:bg-muted/60"
                  }`}
                >
                  <button type="button" onClick={() => toggleBranch(b.id)} className="px-3 py-2 text-left">
                    <span className="font-medium">{b.code}</span>
                    <span className="ml-1.5 text-muted-foreground">{b.name}</span>
                  </button>
                  {selected && selectedBranchIds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPrimaryBranchId(b.id)}
                      className={`border-l px-2 py-2 text-xs ${
                        isPrimary
                          ? "border-blue-200 bg-blue-600 font-semibold text-white"
                          : "border-blue-200 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      หลัก
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </GlassFormSection>

      <GlassFormSection title="แผนกและตำแหน่ง" description="แผนกใช้ชุดเดียวกับเครื่องจักร ตำแหน่งคือกล่องในผังองค์กร">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="แผนก"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            hint={
              selectedBranchIds.length === 0
                ? "เลือกสาขาก่อน จึงจะเห็นแผนกของสาขานั้น"
                : "ไม่บังคับ — แผนกที่ปิดใช้งานจะไม่แสดง"
            }
            options={[
              { value: "", label: "— ไม่ระบุแผนก —" },
              ...departments.map((d) => ({
                value: d.id,
                label: d.code ? `${d.name} (${d.code})` : d.name,
              })),
            ]}
          />
          <Select
            label="ตำแหน่ง"
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
            hint={
              selectedBranchIds.length === 0
                ? "เลือกสาขาก่อน จึงจะเห็นตำแหน่งของสาขานั้น"
                : "ไม่บังคับ — จัดต้นไม้ตำแหน่งได้ที่แท็บตำแหน่ง"
            }
            options={[
              { value: "", label: "— ไม่ระบุตำแหน่ง —" },
              ...positions.map((p) => ({
                value: p.id,
                label: `${"— ".repeat(p.depth)}${p.code ? `${p.name} (${p.code})` : p.name}`,
              })),
            ]}
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
          <Select
            label="บัญชีผู้ใช้"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            hint="ไม่บังคับ — บัญชีในบริษัทนี้ที่ยังไม่ผูกกับคนอื่น"
            options={[
              { value: "", label: "— ไม่ผูกบัญชี —" },
              ...users.map((u) => ({
                value: u.id,
                label: `${`${u.firstName} ${u.lastName}`.trim() || u.username} (${u.username})`,
              })),
            ]}
          />
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
