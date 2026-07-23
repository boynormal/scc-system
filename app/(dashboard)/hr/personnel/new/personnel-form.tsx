"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type BranchOpt = { id: string; name: string; code: string }

export function HrPersonnelForm({ branches }: { branches: BranchOpt[] }) {
  const router = useRouter()
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(() =>
    branches[0]?.id ? [branches[0].id] : []
  )
  const [primaryBranchId, setPrimaryBranchId] = useState<string | null>(() => branches[0]?.id ?? null)

  const selectedSet = useMemo(() => new Set(selectedBranchIds), [selectedBranchIds])

  useEffect(() => {
    if (selectedBranchIds.length === 0) {
      setPrimaryBranchId(null)
      return
    }
    if (!primaryBranchId || !selectedBranchIds.includes(primaryBranchId)) {
      setPrimaryBranchId(selectedBranchIds[0]!)
    }
  }, [selectedBranchIds, primaryBranchId])

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
    const fd = new FormData(e.currentTarget)
    const body = {
      branchIds: selectedBranchIds,
      primaryBranchId: primaryBranchId && selectedSet.has(primaryBranchId) ? primaryBranchId : selectedBranchIds[0] ?? undefined,
      rosterNo: (fd.get("rosterNo") as string) || "",
      displayName: (fd.get("displayName") as string) || "",
      jobGroup: (fd.get("jobGroup") as string) || null,
      firstName: (fd.get("firstName") as string) || null,
      lastName: (fd.get("lastName") as string) || null,
      phone: (fd.get("phone") as string) || null,
    }
    const res = await fetch("/api/hr/personnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr((j as { error?: string }).error ?? "บันทึกไม่สำเร็จ")
      return
    }
    router.push("/hr/personnel")
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</p>}

      <div>
        <p className="block text-sm font-medium text-slate-700 mb-2">สาขาที่ใช้งาน / ลงเวลาได้ (เลือกได้หลายสาขา)</p>
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
          {branches.length === 0 ? (
            <p className="p-3 text-sm text-amber-700">ยังไม่มีสาขาในระบบ</p>
          ) : (
            branches.map((b) => (
              <label key={b.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSet.has(b.id)}
                  onChange={() => toggleBranch(b.id)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-800">
                  {b.code} — {b.name}
                </span>
              </label>
            ))
          )}
        </div>
        {selectedBranchIds.length > 1 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-slate-600">สาขาหลัก (แสดงเป็นค่าเริ่ม / หัวเรคอร์ด)</p>
            <div className="flex flex-wrap gap-2">
              {selectedBranchIds.map((id) => {
                const b = branches.find((x) => x.id === id)
                if (!b) return null
                return (
                  <label key={id} className="inline-flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="primaryBranchPick"
                      checked={primaryBranchId === id}
                      onChange={() => setPrimaryBranchId(id)}
                      className="border-slate-300"
                    />
                    <span>
                      {b.code} — {b.name}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">รหัสรายชื่อ (ลำดับ) *</label>
        <input name="rosterNo" required className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">ชื่อแสดง *</label>
        <input name="displayName" required className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">กลุ่มงาน</label>
        <input name="jobGroup" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">ชื่อจริง</label>
          <input name="firstName" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">นามสกุล</label>
          <input name="lastName" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">โทรศัพท์</label>
        <input name="phone" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
      >
        {loading ? "กำลังบันทึก…" : "บันทึก"}
      </button>
    </form>
  )
}
