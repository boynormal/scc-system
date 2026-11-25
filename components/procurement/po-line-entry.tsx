"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Check, Plus } from "lucide-react"
import { NumberPad, typeDigit, type PadKey } from "@/components/ui/number-pad"
import { cn } from "@/lib/utils"
import { fmtMoney, type PoLine, type PoOptions } from "./po-client"
import { TouchPicker, touchInputClass } from "./touch-controls"

/** Keep a typed price to digits and at most two decimal places. */
function priceText(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "")
  const dot = cleaned.indexOf(".")
  if (dot < 0) return cleaned
  return `${cleaned.slice(0, dot)}.${cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`
}

type Draft = {
  description: string
  quantity: string
  unitId: string
  unitPrice: string
}

function toDraft(line: PoLine | null): Draft {
  return {
    description: line?.description ?? "",
    quantity: line ? String(line.quantity) : "1",
    unitId: line?.unitId ?? "",
    unitPrice: line ? String(line.unitPrice) : "",
  }
}

function num(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Column widths shared by the header, the entry row, and the item table. */
export const poLineCol = {
  name: "min-w-0 flex-1",
  qty: "w-24 shrink-0 whitespace-nowrap text-center",
  unit: "w-40 shrink-0 whitespace-nowrap",
  price: "w-32 shrink-0 whitespace-nowrap text-right",
  total: "flex w-28 shrink-0 justify-end whitespace-nowrap",
} as const

/** One item row typed on the order slip. The keypad opens only for quantity; price is typed. */
export function PoLineEntry({
  line,
  lineNo,
  units,
  autoFocus,
  onSave,
}: {
  line: PoLine | null
  lineNo: number | null
  units: PoOptions["units"]
  autoFocus?: boolean
  onSave: (line: PoLine) => void
}) {
  const t = useTranslations("procurement")
  const rootRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<Draft>(() => toDraft(line))
  const [padOpen, setPadOpen] = useState(false)
  const [replaceNext, setReplaceNext] = useState(true)
  const [errors, setErrors] = useState<{ description?: string; quantity?: string }>({})

  const quantity = num(draft.quantity)
  const unitPrice = num(draft.unitPrice)
  const amount = Math.round(quantity * unitPrice * 100) / 100
  const editing = lineNo !== null

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "nearest" })
  }, [])

  function openQuantityPad() {
    setPadOpen(true)
    setReplaceNext(true)
  }

  function pressKey(key: PadKey) {
    const next = typeDigit(draft.quantity, key, 3, replaceNext)
    if (next === null) return
    setReplaceNext(false)
    setDraft((d) => ({ ...d, quantity: next }))
    setErrors((e) => ({ ...e, quantity: undefined }))
  }

  function submit() {
    const nextErrors: typeof errors = {}
    if (!draft.description.trim()) nextErrors.description = t("lineDescriptionRequired")
    if (!(quantity > 0)) nextErrors.quantity = t("lineQuantityRequired")
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const unit = units.find((u) => u.id === draft.unitId)
    onSave({
      id: line?.id,
      description: draft.description.trim(),
      quantity,
      unitId: unit?.id ?? null,
      unitCode: unit?.code ?? null,
      unitPrice,
      amount,
      costObjectType: null,
      costObjectLabel: null,
    })
  }

  const qtyButton = cn(
    "flex h-12 min-w-0 items-center justify-center rounded-xl border bg-background px-2 text-base font-semibold tabular-nums text-foreground",
    padOpen ? "border-blue-600 ring-2 ring-blue-600" : "border-input"
  )
  return (
    <div ref={rootRef} className="space-y-1">
      <div className="flex w-full min-w-0 items-center gap-2">
        <input
          autoFocus={autoFocus}
          aria-label={t("lineDescription")}
          value={draft.description}
          onFocus={() => setPadOpen(false)}
          onChange={(e) => {
            setDraft((d) => ({ ...d, description: e.target.value }))
            setErrors((er) => ({ ...er, description: undefined }))
          }}
          placeholder={t("lineDescription")}
          maxLength={500}
          className={cn(touchInputClass, poLineCol.name, errors.description && "border-red-400")}
        />
        <button type="button" aria-label={t("lineQuantity")} onClick={openQuantityPad} className={cn(qtyButton, poLineCol.qty)}>
          {draft.quantity || "0"}
        </button>
        <div className={poLineCol.unit}>
          <TouchPicker
            compact
            label={t("lineUnit")}
            value={draft.unitId}
            onChange={(unitId) => setDraft((d) => ({ ...d, unitId }))}
            options={[
              { value: "", label: t("lineNoUnit") },
              ...units.map((u) => ({ value: u.id, label: u.name, hint: u.code })),
            ]}
            placeholder={t("lineUnit")}
            searchPlaceholder={t("pickerSearch")}
            emptyText={t("pickerEmpty")}
          />
        </div>
        <input
          aria-label={t("lineUnitPrice")}
          inputMode="decimal"
          value={draft.unitPrice}
          onFocus={() => setPadOpen(false)}
          onChange={(e) => setDraft((d) => ({ ...d, unitPrice: priceText(e.target.value) }))}
          placeholder="0"
          className={cn(touchInputClass, poLineCol.price, "px-2 text-right")}
        />
        <span className={poLineCol.total}>
        <button
          type="button"
          aria-label={editing ? t("saveLine") : t("addLine")}
          title={editing ? t("editingLineNo", { no: lineNo ?? 0 }) : t("addLine")}
          onClick={submit}
          className={cn(
            "ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95",
            editing
              ? "bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-500"
              : "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-600"
          )}
        >
          {editing ? <Check className="h-6 w-6" strokeWidth={2.75} /> : <Plus className="h-6 w-6" strokeWidth={2.75} />}
        </button>
        </span>
      </div>
      {errors.description || errors.quantity ? (
        <p role="alert" className="px-1 text-sm text-red-500">
          {errors.description ?? errors.quantity}
        </p>
      ) : null}
      {padOpen ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-base text-foreground">{t("lineAmount")}</span>
            <span className="text-xl font-semibold tabular-nums text-foreground">{fmtMoney(amount)}</span>
          </div>
          <NumberPad label={t("padEditing", { field: t("lineQuantity") })} value={draft.quantity} onKey={pressKey} />
        </div>
      ) : null}
    </div>
  )
}
