"use client"

import type { MutableRefObject } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
  CustomerPicker,
  type TmsCustomerOption,
} from "@/components/transport/CustomerPicker"

export type JobStopForm = {
  id?: string
  sequence: number
  customerId: string
  customerName: string
  address: string
  contactName: string
  contactPhone: string
  weightKg: string
  notes: string
}

export type DestinationPrefillSnap = {
  customerId: string
  customerName: string
  address: string
  contactName: string
  contactPhone: string
}

export function emptyJobStop(sequence = 1): JobStopForm {
  return {
    sequence,
    customerId: "",
    customerName: "",
    address: "",
    contactName: "",
    contactPhone: "",
    weightKg: "",
    notes: "",
  }
}

function resequence(stops: JobStopForm[]) {
  return stops.map((s, i) => ({ ...s, sequence: i + 1 }))
}

function isDestinationEmpty(s: JobStopForm) {
  return !s.customerId && !s.customerName && !s.address && !s.contactName && !s.contactPhone
}

function matchesPrefillSnap(s: JobStopForm, snap: DestinationPrefillSnap | null) {
  if (!snap) return false
  return (
    s.customerId === snap.customerId &&
    s.customerName === snap.customerName &&
    s.address === snap.address &&
    s.contactName === snap.contactName &&
    s.contactPhone === snap.contactPhone
  )
}

/** Prefill last stop from header customer when empty or still matching prior autofill. */
export function applyHeaderCustomerToStops(
  stops: JobStopForm[],
  snapRef: MutableRefObject<DestinationPrefillSnap | null>,
  customerId: string,
  customer: TmsCustomerOption | null
): JobStopForm[] {
  if (!customerId || !customer || stops.length === 0) return stops

  const nextSnap: DestinationPrefillSnap = {
    customerId,
    customerName: customer.name,
    address: customer.address ?? "",
    contactName: customer.contactName ?? "",
    contactPhone: customer.phone ?? "",
  }

  const lastIdx = stops.length - 1
  const last = stops[lastIdx]
  const canPrefill =
    isDestinationEmpty(last) || matchesPrefillSnap(last, snapRef.current)
  if (!canPrefill) return stops

  snapRef.current = nextSnap
  return stops.map((s, i) =>
    i === lastIdx
      ? {
          ...s,
          customerId: nextSnap.customerId,
          customerName: nextSnap.customerName,
          address: nextSnap.address,
          contactName: nextSnap.contactName,
          contactPhone: nextSnap.contactPhone,
        }
      : s
  )
}

type Props = {
  stops: JobStopForm[]
  onChange: (stops: JobStopForm[]) => void
  disabled?: boolean
  className?: string
}

export function JobStopsEditor({ stops, onChange, disabled, className }: Props) {
  const addStop = () => {
    if (disabled) return
    if (stops.length === 0) {
      onChange([emptyJobStop()])
      return
    }
    const last = stops[stops.length - 1]
    const before = stops.slice(0, -1)
    onChange(resequence([...before, emptyJobStop(), last]))
  }

  const removeStop = (idx: number) => {
    if (disabled || stops.length <= 1) return
    onChange(resequence(stops.filter((_, i) => i !== idx)))
  }

  const updateStop = (idx: number, field: keyof JobStopForm, value: string) => {
    if (disabled) return
    onChange(stops.map((s, i) => (i === idx ? { ...s, [field]: value } : s)))
  }

  const handleStopCustomer = (
    idx: number,
    customerId: string,
    customer: TmsCustomerOption | null
  ) => {
    if (disabled) return
    onChange(
      stops.map((s, i) =>
        i === idx
          ? {
              ...s,
              customerId,
              customerName: customer?.name ?? s.customerName,
              address: customer?.address ?? s.address,
              contactName: customer?.contactName ?? s.contactName,
              contactPhone: customer?.phone ?? s.contactPhone,
            }
          : s
      )
    )
  }

  return (
    <div className={className ?? "space-y-3"}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">จุดแวะ (Stops)</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ลูกค้าหัวใบงานจะเติมจุดหมายสุดท้ายให้อัตโนมัติ — จุดที่เพิ่มเป็นจุดแวะระหว่างทาง
          </p>
        </div>
        <button
          type="button"
          onClick={addStop}
          disabled={disabled}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> เพิ่มจุดแวะ
        </button>
      </div>

      {stops.map((stop, idx) => {
        const isLast = idx === stops.length - 1
        return (
          <div key={stop.id ?? `new-${idx}`} className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Stop {stop.sequence}
                {" · "}
                {isLast ? "จุดหมายสุดท้าย" : "จุดแวะระหว่างทาง"}
              </span>
              {stops.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStop(idx)}
                  disabled={disabled}
                  className="text-red-400 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">เลือกจาก Master</label>
              <CustomerPicker
                value={stop.customerId}
                onChange={(customerId, customer) => handleStopCustomer(idx, customerId, customer)}
                placeholder="— เลือกลูกค้า/ปลายทาง —"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">ชื่อลูกค้า / ปลายทาง *</label>
                <input
                  required
                  disabled={disabled}
                  value={stop.customerName}
                  onChange={(e) => updateStop(idx, "customerName", e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">ที่อยู่ *</label>
                <input
                  required
                  disabled={disabled}
                  value={stop.address}
                  onChange={(e) => updateStop(idx, "address", e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">ชื่อผู้ติดต่อ</label>
                <input
                  disabled={disabled}
                  value={stop.contactName}
                  onChange={(e) => updateStop(idx, "contactName", e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">เบอร์โทร</label>
                <input
                  disabled={disabled}
                  value={stop.contactPhone}
                  onChange={(e) => updateStop(idx, "contactPhone", e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">น้ำหนัก (กก.)</label>
                <input
                  type="number"
                  min="0"
                  disabled={disabled}
                  value={stop.weightKg}
                  onChange={(e) => updateStop(idx, "weightKg", e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">หมายเหตุ</label>
                <textarea
                  disabled={disabled}
                  value={stop.notes}
                  onChange={(e) => updateStop(idx, "notes", e.target.value)}
                  rows={2}
                  placeholder="หมายเหตุสำหรับจุดนี้ (ถ้ามี)"
                  className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
