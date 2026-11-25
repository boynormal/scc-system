"use client"

import { useEffect, useState } from "react"
import { ShoppingCart } from "lucide-react"
import { fetchJson } from "@/lib/client-fetch"
import type { ProcurementSourceAttachment } from "./expense-types"
import { IncomeFileThumbs } from "./income-file-thumbs"

type PoSource = { sourceId: string; documentNo: string | null; attachments: ProcurementSourceAttachment[] }

/** Read-only photos of the purchase orders a bill was created from. They stay owned by Procurement. */
export function PurchaseOrderSourcePhotos({ ids }: { ids: string[] }) {
  const [orders, setOrders] = useState<PoSource[]>([])
  const key = [...new Set(ids)].sort().join(",")

  useEffect(() => {
    if (!key) return
    let cancelled = false
    Promise.all(
      key.split(",").map((id) =>
        fetchJson<{ data: PoSource }>(`/api/finance/expenses/sources/purchase-orders/${id}`)
          .then((res) => res.data)
          .catch(() => null)
      )
    ).then((rows) => {
      if (!cancelled) setOrders(rows.filter((r): r is PoSource => r !== null && r.attachments.length > 0))
    })
    return () => {
      cancelled = true
    }
  }, [key])

  if (orders.length === 0) return null
  return (
    <div className="space-y-2">
      {orders.map((po) => (
        <div key={po.sourceId} className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <ShoppingCart className="h-4 w-4" />
            รูปจากใบสั่งซื้อ {po.documentNo ?? ""}
          </p>
          <IncomeFileThumbs
            removeLabel=""
            removingKey={null}
            items={po.attachments.map((a) => ({
              key: a.id,
              name: a.fileName,
              href: a.url,
              preview: a.contentType.startsWith("image/"),
              removable: false,
            }))}
          />
        </div>
      ))}
    </div>
  )
}
