"use client"

import { useState, useEffect, useMemo } from "react"
import { decimalToNumber } from "@/shared/transport/coordinates"

export type TmsCustomerOption = {
  id: string
  code: string | null
  name: string
  address: string | null
  contactName: string | null
  phone: string | null
  latitude?: number | null
  longitude?: number | null
}

type CustomerPickerProps = {
  value: string
  onChange: (customerId: string, customer: TmsCustomerOption | null) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export function CustomerPicker({
  value,
  onChange,
  placeholder = "— เลือกลูกค้า/ปลายทาง —",
  required,
  className = "",
}: CustomerPickerProps) {
  const [customers, setCustomers] = useState<TmsCustomerOption[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/transport/master-data/customers?activeOnly=1")
      .then((r) => r.json())
      .then((json) => {
        const rows = (json.data ?? []) as Array<Record<string, unknown>>
        setCustomers(
          rows.map((c) => ({
            id: String(c.id),
            code: (c.code as string | null) ?? null,
            name: String(c.name),
            address: (c.address as string | null) ?? null,
            contactName: (c.contactName as string | null) ?? null,
            phone: (c.phone as string | null) ?? null,
            latitude: decimalToNumber(c.latitude),
            longitude: decimalToNumber(c.longitude),
          }))
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code?.toLowerCase().includes(q) ?? false) ||
        (c.address?.toLowerCase().includes(q) ?? false)
    )
  }, [customers, search])

  const handleSelect = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId) ?? null
    onChange(customerId, customer)
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหาลูกค้า..."
        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
      <select
        required={required}
        value={value}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={loading}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
      >
        <option value="">{loading ? "กำลังโหลด..." : placeholder}</option>
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}{c.code ? ` (${c.code})` : ""}
          </option>
        ))}
      </select>
    </div>
  )
}
