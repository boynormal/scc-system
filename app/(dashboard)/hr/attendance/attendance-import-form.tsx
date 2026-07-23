"use client"

import { useState } from "react"

type BranchOpt = { id: string; name: string; code: string }

export function AttendanceImportForm({ branch }: { branch: BranchOpt }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<Array<{ rosterNo: string; displayName: string; currentBranch: string }>>([])
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // หลัง await, React จะทำให้ e.currentTarget เป็น null — อ้างอิง form ก่อน async
    const form = e.currentTarget
    setMsg(null)
    setErr(null)
    setConflicts([])
    const fd = new FormData(form)
    const branchId = branch.id
    const file = fd.get("file")
    if (!(file instanceof File) || file.size === 0) {
      setErr("เลือกไฟล์ .xls / .xlsx")
      return
    }
    setLoading(true)
    const up = new FormData()
    up.set("branchId", branchId)
    up.set("file", file)
    const res = await fetch("/api/hr/attendance/import", { method: "POST", body: up })
    setLoading(false)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      const body = j as {
        error?: string
        conflicts?: Array<{ rosterNo: string; displayName: string; currentBranch: string }>
      }
      setErr(body.error ?? "นำเข้าไม่สำเร็จ")
      setConflicts(Array.isArray(body.conflicts) ? body.conflicts : [])
      return
    }
    const d = (j as { data?: { rowCount?: number; attendanceEntries?: number } }).data
    setMsg(
      `นำเข้าแล้ว แถวรวม ${d?.rowCount ?? 0} รายการ · บันทึกเวลา ${d?.attendanceEntries ?? 0} แถว`
    )
    form.reset()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</p>}
      {conflicts.length > 0 && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 space-y-1">
          <p className="font-medium">รายการที่ชนข้ามสาขา:</p>
          {conflicts.slice(0, 8).map((c) => (
            <p key={`${c.rosterNo}-${c.currentBranch}`}>
              • {c.rosterNo} {c.displayName} (อยู่ที่ {c.currentBranch})
            </p>
          ))}
          {conflicts.length > 8 && <p>... และอีก {conflicts.length - 8} รายการ</p>}
        </div>
      )}
      {msg && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">{msg}</p>}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="text-slate-500">สาขาปลายทาง (ล็อกจากบริบทหน้า)</p>
        <p className="font-medium text-slate-800 mt-1">
          {branch.code} {branch.name}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">ไฟล์ Excel บันทึกเวลา (.xls / .xlsx)</label>
        <input
          name="file"
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="mt-1 block w-full text-sm text-slate-600"
        />
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">
        รูปแบบคอลัมน์: A=ลำดับ, C=ชื่อ, D=กลุ่มงาน, E=วันที่ (DD-MM-YYYY), คอลัมน์ถัดไปเป็นเวลา HH:MM ตามลำดับการสแกน
      </p>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
      >
        {loading ? "กำลังนำเข้า…" : "นำเข้า"}
      </button>
    </form>
  )
}
