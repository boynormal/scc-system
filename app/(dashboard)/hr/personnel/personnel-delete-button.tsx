"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function PersonnelDeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    if (!window.confirm("ลบรายชื่อนี้ออกจากทะเบียน? รายการจะถูกปิดใช้งานและไม่แสดงในรายการอีก")) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/hr/personnel/${id}`, { method: "DELETE" })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "ลบไม่สำเร็จ")
      return
    }
    router.push("/hr/personnel")
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onDelete()}
        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? "กำลังลบ…" : "ลบ"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
