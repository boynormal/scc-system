"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { CheckCircle2 } from "lucide-react"
import type { FuelTankDto, FuelTxnDto } from "@/modules/fuel"
import { DataPanel } from "@/components/shell/data-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { fmtCost, fmtMoney, fmtQty, localInputToIso } from "./fuel-format"
import { OccurredAtField, TankPicker, TankStatusLine, TextArea, initialBranchTank } from "./fuel-entry-shared"

type Option = { id: string; name: string }

export function ReceiveForm({
  branches,
  tanks: initialTanks,
  suppliers,
  presetTankId,
}: {
  branches: Option[]
  tanks: FuelTankDto[]
  suppliers: Option[]
  presetTankId?: string | null
}) {
  const t = useTranslations("fuel")
  const [tanks, setTanks] = useState(initialTanks)
  const [{ branchId, tankId }, setPick] = useState(() => initialBranchTank(branches, initialTanks, presetTankId))
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [documentNo, setDocumentNo] = useState("")
  const [occurredAt, setOccurredAt] = useState("")
  const [remark, setRemark] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<FuelTxnDto | null>(null)

  const tank = tanks.find((x) => x.id === tankId) ?? null
  const qty = Number(quantity)
  const price = Number(unitCost)
  const afterQty = tank && quantity !== "" && Number.isFinite(qty) ? Math.round((tank.currentQty + qty) * 100) / 100 : null
  const total = quantity !== "" && unitCost !== "" ? Math.round(qty * price * 100) / 100 : null

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetchJson<{ data: FuelTxnDto }>("/api/fuel/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "RECEIVE",
          tankId,
          quantity: qty,
          unitCost: price,
          supplierId: supplierId || null,
          documentNo: documentNo || null,
          occurredAt: localInputToIso(occurredAt),
          remark: remark || null,
        }),
      })
      setTanks((list) =>
        list.map((x) =>
          x.id === tankId
            ? {
                ...x,
                currentQty: res.data.balanceAfter,
                avgCost: res.data.avgCostAfter,
                fillPercent: x.capacity > 0 ? Math.round((res.data.balanceAfter / x.capacity) * 1000) / 10 : 0,
                isLow: res.data.balanceAfter < x.minLevel,
              }
            : x
        )
      )
      setSaved(res.data)
      setQuantity("")
      setDocumentNo("")
      setOccurredAt("")
      setRemark("")
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DataPanel padding="md" className="max-w-3xl">
      {saved && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {t("saved")}: {t("type_RECEIVE")} {fmtQty(saved.quantity)} {saved.unit} · {saved.tankCode}
            </p>
            <p>
              {t("remainingAfter")} {fmtQty(saved.balanceAfter)} {saved.unit} · {t("avgCost")} {fmtCost(saved.avgCostAfter)}
            </p>
            <Link href={`/fuel/tanks/${saved.tankId}`} className="font-medium underline">
              {t("ledgerTitle")}
            </Link>
          </div>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <TankPicker
          branches={branches}
          tanks={tanks}
          branchId={branchId}
          tankId={tankId}
          onBranch={(id) => {
            const own = tanks.filter((x) => x.branchId === id)
            setPick({ branchId: id, tankId: own.length === 1 ? own[0].id : "" })
          }}
          onTank={(id) => setPick((p) => ({ ...p, tankId: id }))}
        />
        {tank && <TankStatusLine tank={tank} afterQty={afterQty} />}
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label={t("quantity")}
            required
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            label={t("unitCost")}
            required
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0001"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
          <Input label={t("totalCost")} readOnly value={total === null ? "" : fmtMoney(total)} tabIndex={-1} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label={t("supplier")}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            placeholder={t("noSupplier")}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Input label={t("documentNo")} maxLength={50} value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} />
        </div>
        <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
        <TextArea label={t("remark")} value={remark} onChange={setRemark} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" loading={busy} disabled={!tank}>
            {t("submitReceive")}
          </Button>
        </div>
      </form>
    </DataPanel>
  )
}
