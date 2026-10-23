"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import {
  HOLD_REASON_LABEL,
  HOLD_REASONS,
  WORK_ORDER_STATUS_LABEL,
  transitionsFrom,
  type WorkOrderStatusName,
} from "@/modules/work_orders/application/work-order-transitions"

export function WorkOrderTransitionPanel(props: { workOrderId: string; status: string }) {
  const router = useRouter()
  const [status, setStatus] = useState(props.status)
  useEffect(() => setStatus(props.status), [props.status])
  const rules = transitionsFrom(status)
  const [holdReason, setHoldReason] = useState("")
  const [textReason, setTextReason] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const needsAssignee = rules.some((rule) => rule.needsAssignee)
  const needsHold = rules.some((rule) => rule.reason === "hold")
  const needsText = rules.some((rule) => rule.reason === "text")

  async function loadUsers() {
    if (users.length > 0) return
    const response = await fetch("/api/users")
    const json = await response.json()
    setUsers(json.data ?? [])
  }

  async function run(to: WorkOrderStatusName) {
    const rule = rules.find((item) => item.to === to)
    setError(null)
    setPending(to)
    const response = await fetch(`/api/work-orders/${props.workOrderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toStatus: to,
        reason: rule?.reason === "hold" ? holdReason : rule?.reason === "text" ? textReason : undefined,
        assignedTo: assignedTo || undefined,
      }),
    })
    setPending(null)
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(typeof json.error === "string" ? json.error : "เปลี่ยนสถานะไม่ได้")
      return
    }
    if (typeof json.data?.status === "string") setStatus(json.data.status)
    setHoldReason("")
    setTextReason("")
    router.refresh()
  }

  if (rules.length === 0) return null

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">
        สถานะปัจจุบัน: {WORK_ORDER_STATUS_LABEL[status as WorkOrderStatusName] ?? status}
      </p>
      {needsAssignee && (
        <Select
          label="ผู้รับผิดชอบสำหรับมอบหมาย"
          placeholder="เลือกผู้รับผิดชอบ"
          value={assignedTo}
          onFocus={() => void loadUsers()}
          onChange={(event) => setAssignedTo(event.target.value)}
          options={users.map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}` }))}
        />
      )}
      {needsHold && (
        <Select
          label="เหตุผลการรอ"
          placeholder="เลือกเหตุผล"
          value={holdReason}
          onChange={(event) => setHoldReason(event.target.value)}
          options={HOLD_REASONS.map((item) => ({ value: item, label: HOLD_REASON_LABEL[item] }))}
        />
      )}
      {needsText && (
        <label className="block text-sm text-foreground">
          เหตุผล
          <input
            value={textReason}
            onChange={(event) => setTextReason(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
          />
        </label>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {rules.map((rule) => (
          <Button
            key={rule.to}
            type="button"
            variant={rule.to === "cancelled" ? "outline" : "primary"}
            disabled={pending !== null}
            onClick={() => void run(rule.to)}
          >
            {pending === rule.to ? "กำลังบันทึก" : WORK_ORDER_STATUS_LABEL[rule.to]}
          </Button>
        ))}
      </div>
    </div>
  )
}
