"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { GlassDialog } from "@/components/glass"
import { decimalToNumber } from "@/shared/transport/coordinates"

export type TmsCustomerOption = {
  id: string
  code: string | null
  name: string
  address: string | null
  contactName: string | null
  phone: string | null
  details: string | null
  latitude?: number | null
  longitude?: number | null
}

type CustomerPickerProps = {
  value: string
  onChange: (customerId: string, customer: TmsCustomerOption | null) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export function CustomerPicker({
  value,
  onChange,
  placeholder = "— เลือกลูกค้า/ปลายทาง —",
  required,
  disabled,
  className = "",
}: CustomerPickerProps) {
  const [customers, setCustomers] = useState<TmsCustomerOption[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

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
            details: (c.details as string | null) ?? null,
            latitude: decimalToNumber(c.latitude),
            longitude: decimalToNumber(c.longitude),
          }))
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selected = customers.find((c) => c.id === value) ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) =>
      [c.name, c.code, c.address, c.contactName, c.phone, c.details].some((part) =>
        (part ?? "").toLowerCase().includes(q)
      )
    )
  }, [customers, search])

  const choose = (customer: TmsCustomerOption | null) => {
    onChange(customer?.id ?? "", customer)
    setOpen(false)
    setSearch("")
  }

  return (
    <div className={className}>
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          className="sr-only"
        />
      ) : null}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
      >
        {loading ? "กำลังโหลด..." : selected ? selected.name : placeholder}
      </button>

      <GlassDialog open={open} onOpenChange={setOpen} title="เลือกลูกค้า/ปลายทาง" className="max-w-lg">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / ที่อยู่ / ผู้ติดต่อ / รายละเอียด..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => choose(null)}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60"
            >
              {placeholder}
            </button>
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">ไม่พบลูกค้า</li>
          ) : (
            filtered.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  onClick={() => choose(customer)}
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted/60"
                >
                  <span className="block text-sm font-medium text-foreground">
                    {customer.name}
                    {customer.code ? <span className="font-normal text-muted-foreground"> ({customer.code})</span> : null}
                  </span>
                  {customer.address ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{customer.address}</span>
                  ) : null}
                  {customer.details ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{customer.details}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </GlassDialog>
    </div>
  )
}
