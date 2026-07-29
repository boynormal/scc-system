"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { th } from "date-fns/locale"
import { AlertTriangle, CalendarX2, Trash2, X } from "lucide-react"

export function isDeleteConfirmation(input: string): boolean {
  const t = input.trim()
  return t.toLowerCase() === "yes" || t === "ยืนยันการลบ"
}

export type AttendanceRow = {
  id: string
  workDate: string
  rosterNo: string
  displayName: string
  jobGroup: string | null
  punchTimes: string[]
  branchCode: string
  branchName: string
}

type BranchOpt = { id: string; name: string; code: string }

function ModalScrim({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      {children}
    </div>
  )
}

function ModalPanel({ children, labelledBy, className = "" }: { children: React.ReactNode; labelledBy: string; className?: string }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={`relative w-full max-w-md rounded-2xl border border-border/80 bg-card shadow-2xl ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

export function AttendanceEntriesPanel({
  rows,
  branch,
  canDelete,
}: {
  rows: AttendanceRow[]
  branch: BranchOpt
  canDelete: boolean
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [loadingDay, setLoadingDay] = useState(false)
  const [dayValue, setDayValue] = useState("")
  const [dayConfirmInput, setDayConfirmInput] = useState("")
  const [dayModalOpen, setDayModalOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [rowConfirmInput, setRowConfirmInput] = useState("")

  useEffect(() => {
    setDayConfirmInput("")
  }, [dayValue])

  const dayConfirmOk = isDeleteConfirmation(dayConfirmInput)
  const rowConfirmOk = isDeleteConfirmation(rowConfirmInput)

  function closeDayModal() {
    setDayModalOpen(false)
    setDayConfirmInput("")
  }

  async function executeDeleteOne(id: string) {
    if (!canDelete) return
    setLoadingId(id)
    try {
      const res = await fetch(`/api/hr/attendance/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert((j as { error?: string }).error ?? "ลบไม่สำเร็จ")
        return
      }
      setPendingDeleteId(null)
      setRowConfirmInput("")
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  async function deleteByDay() {
    if (!canDelete || !dayValue || !dayConfirmOk) return
    setLoadingDay(true)
    try {
      const res = await fetch("/api/hr/attendance/by-day", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: branch.id, workDate: dayValue }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert((j as { error?: string }).error ?? "ลบไม่สำเร็จ")
        return
      }
      const n = (j as { deleted?: number }).deleted ?? 0
      alert(`ลบแล้ว ${n} รายการ`)
      closeDayModal()
      router.refresh()
    } finally {
      setLoadingDay(false)
    }
  }

  if (rows.length === 0) return null

  return (
    <div className="space-y-3">
      {canDelete && (
        <div className="flex justify-end px-0.5">
          <button
            type="button"
            onClick={() => setDayModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:border-border hover:bg-muted/60"
          >
            <CalendarX2 className="h-3.5 w-3.5" aria-hidden />
            ลบตามวันที่...
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-muted-foreground">
              {canDelete && <th className="p-3 w-12 font-medium" />}
              <th className="p-3 font-medium">วันที่</th>
              <th className="p-3 font-medium">สาขา</th>
              <th className="p-3 font-medium">รหัส / ชื่อ</th>
              <th className="p-3 font-medium">กลุ่มงาน</th>
              <th className="p-3 font-medium">เวลา (ลำดับ)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/60/80">
                {canDelete && (
                  <td className="p-2 align-top">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDeleteId(row.id)
                        setRowConfirmInput("")
                      }}
                      disabled={loadingId === row.id}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                      title="ลบรายการนี้"
                      aria-label="ลบรายการนี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
                <td className="p-3 whitespace-nowrap text-foreground">{format(parseISO(row.workDate), "d MMM yyyy", { locale: th })}</td>
                <td className="p-3 text-muted-foreground text-xs">{row.branchCode} — {row.branchName}</td>
                <td className="p-3">
                  <div className="font-mono text-muted-foreground text-xs">{row.rosterNo}</div>
                  <div className="text-foreground">{row.displayName}</div>
                </td>
                <td className="p-3 text-muted-foreground">{row.jobGroup ?? "—"}</td>
                <td className="p-3 text-foreground font-mono text-xs max-w-md">{row.punchTimes.length ? row.punchTimes.join(" → ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingDeleteId && (
        <ModalScrim onClose={() => { setPendingDeleteId(null); setRowConfirmInput("") }}>
          <ModalPanel labelledBy="attendance-row-delete-title" className="p-0 overflow-hidden max-h-[min(90vh,520px)] flex flex-col">
            <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
              <h2 id="attendance-row-delete-title" className="text-base font-semibold text-foreground pr-2">แจ้งเตือน</h2>
              <button type="button" onClick={() => { setPendingDeleteId(null); setRowConfirmInput("") }} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground" aria-label="ปิด">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1 min-h-0">
              <p className="flex gap-2 text-sm text-muted-foreground leading-snug">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" aria-hidden />
                <span>ลบรายนี้แล้ว <span className="font-medium text-foreground">กู้คืนไม่ได้</span> — พิมพ์ <span className="font-mono">Yes</span> หรือ <span className="font-mono">ยืนยันการลบ</span></span>
              </p>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">ยืนยันด้วยการพิมพ์</label>
                <input type="text" value={rowConfirmInput} onChange={(e) => setRowConfirmInput(e.target.value)} autoComplete="off" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Yes หรือ ยืนยันการลบ" autoFocus />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3 bg-muted/80">
              <button type="button" onClick={() => { setPendingDeleteId(null); setRowConfirmInput("") }} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted">ยกเลิก</button>
              <button type="button" onClick={() => pendingDeleteId && executeDeleteOne(pendingDeleteId)} disabled={!rowConfirmOk || loadingId === pendingDeleteId || !pendingDeleteId} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{loadingId === pendingDeleteId ? "กำลังลบ…" : "ดำเนินการลบ"}</button>
            </div>
          </ModalPanel>
        </ModalScrim>
      )}

      {dayModalOpen && (
        <ModalScrim onClose={closeDayModal}>
          <ModalPanel labelledBy="attendance-day-delete-title" className="p-0 overflow-hidden max-h-[min(90vh,560px)] flex flex-col">
            <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
              <h2 id="attendance-day-delete-title" className="text-base font-semibold text-foreground pr-2">ลบบันทึกเวลาตามวัน</h2>
              <button type="button" onClick={closeDayModal} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground" aria-label="ปิด"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1 min-h-0">
              <p className="flex gap-2 text-sm text-muted-foreground leading-snug">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" aria-hidden />
                <span>ลบ <span className="font-medium text-foreground">ทุกรายการ</span> ในวันของสาขานี้: <span className="font-medium text-foreground">{branch.code} {branch.name}</span></span>
              </p>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">สาขา (ล็อกจากบริบทหน้า)</label>
                <div className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted text-foreground">{branch.code} {branch.name}</div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">วันที่</label>
                <input type="date" value={dayValue} onChange={(e) => setDayValue(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">พิมพ์ <span className="font-mono text-foreground">Yes</span> หรือ <span className="font-mono text-foreground">ยืนยันการลบ</span></label>
                <input type="text" value={dayConfirmInput} onChange={(e) => setDayConfirmInput(e.target.value)} autoComplete="off" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Yes หรือ ยืนยันการลบ" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3 bg-muted/80">
              <button type="button" onClick={closeDayModal} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted">ยกเลิก</button>
              <button type="button" onClick={deleteByDay} disabled={loadingDay || !dayValue || !dayConfirmOk} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 disabled:opacity-50">{loadingDay ? "กำลังลบ…" : "ลบทั้งหมดในวันนี้"}</button>
            </div>
          </ModalPanel>
        </ModalScrim>
      )}
    </div>
  )
}

