"use client"

import { useMemo, useState } from "react"
import { Check, ChevronRight, Coins, Delete, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { GlassDialog, GlassInput } from "@/components/glass"
import { cn } from "@/lib/utils"
import {
  TAX_MODES,
  VAT_RATE,
  type AssetOption,
  type CostCenterRow,
  type DiscountKind,
  type ExpenseTypeOption,
  type LineDraft,
  type TaxMode,
  type UnitOption,
} from "./expense-types"
import {
  applyTypeChange,
  costCenterOptions,
  isLegacyUnrestricted,
  validateLineDraft,
} from "./expense-form-validation"
import { COST_OBJECT_TYPE_LABELS, PRICING_MODE_LABELS, formatBaht, sourceModuleLabel } from "./finance-theme"
import { ExpenseTypePicker, defaultExpenseCategoryKey } from "./expense-type-picker"

export function newLineDraft(): LineDraft {
  return {
    key: `line-${Math.random().toString(36).slice(2, 10)}`,
    expenseTypeId: "",
    description: "",
    pricingMode: "AMOUNT",
    quantity: "1",
    unitId: "",
    unitCode: "",
    unitPrice: "",
    amount: "",
    taxAmount: "",
    taxMode: "NONE",
    discountAmount: "",
    discountKind: "BAHT",
    costCenterId: "",
    costObjectType: "",
    costObjectId: "",
    costObjectLabel: "",
    sourceKind: "MANUAL",
    sourceModule: null,
    sourceType: null,
    sourceDocumentId: null,
    sourceLineId: null,
    sourceAmountLocked: false,
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

type MoneyField = "quantity" | "unitPrice" | "amount" | "discountAmount"

const PAD_KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "back"] as const

function typeDigit(current: string, key: string, maxDecimals: number, replace: boolean): string | null {
  if (key === "back") return replace ? "" : current.slice(0, -1)
  let base = replace ? "" : current
  if (key === ".") {
    if (base.includes(".")) return null
    return `${base === "" ? "0" : base}.`
  }
  if (base === "0") base = ""
  const dot = base.indexOf(".")
  if (dot >= 0 && base.length - dot - 1 >= maxDecimals) return null
  return base + key
}

function sanitizeDecimal(raw: string, maxDecimals: number, maxValue?: number): string {
  const cleaned = raw.replace(/[^\d.]/g, "")
  if (cleaned === "") return ""
  const dot = cleaned.indexOf(".")
  let whole = (dot >= 0 ? cleaned.slice(0, dot) : cleaned).replace(/\./g, "")
  const frac = dot >= 0 ? cleaned.slice(dot + 1).replace(/\./g, "").slice(0, maxDecimals) : ""
  whole = whole.replace(/^0+(?=\d)/, "")
  if (whole === "") whole = dot >= 0 ? "0" : ""
  const next = dot >= 0 ? `${whole}.${frac}` : whole
  if (maxValue != null && next !== "" && next !== "0." && Number(next) > maxValue) return String(maxValue)
  return next
}

export function computeLineAmount(draft: Pick<LineDraft, "pricingMode" | "quantity" | "unitPrice" | "amount">): number {
  if (draft.pricingMode === "QTY_PRICE") {
    const qty = Number(draft.quantity) || 0
    const price = Number(draft.unitPrice) || 0
    return round2(qty * price)
  }
  return Number(draft.amount) || 0
}

export function computeDiscountBaht(draft: LineDraft): number {
  const amount = computeLineAmount(draft)
  const raw = Number(draft.discountAmount) || 0
  if (draft.discountKind === "PERCENT") {
    return round2(amount * raw / 100)
  }
  return round2(raw)
}

/**
 * Mirrors computeLineTax on the server: 7% on max(0, amount − discount).
 * `useStored` keeps the saved tax for paid bills, whose money cannot change.
 */
export function computeLineTax(draft: LineDraft, useStored = false): number {
  if (useStored) return round2(Number(draft.taxAmount) || 0)
  const base = Math.max(0, round2(computeLineAmount(draft) - computeDiscountBaht(draft)))
  if (draft.taxMode === "VAT_EXCLUSIVE") return round2(base * VAT_RATE)
  if (draft.taxMode === "VAT_INCLUSIVE") return round2((base * VAT_RATE) / (1 + VAT_RATE))
  return 0
}

export function computeLineNet(draft: LineDraft, useStored = false): number {
  const base = Math.max(0, round2(computeLineAmount(draft) - computeDiscountBaht(draft)))
  if (draft.taxMode === "VAT_INCLUSIVE") return base
  return round2(base + computeLineTax(draft, useStored))
}

const TAX_MODE_LABELS: Record<TaxMode, string> = {
  NONE: "ไม่มี",
  VAT_EXCLUSIVE: "VAT 7% แยก",
  VAT_INCLUSIVE: "VAT 7% รวม",
}

const NET_HINTS: Record<TaxMode, string> = {
  NONE: "จำนวนเงิน − ส่วนลด",
  VAT_EXCLUSIVE: "จำนวนเงิน − ส่วนลด + VAT 7%",
  VAT_INCLUSIVE: "จำนวนเงิน − ส่วนลด รวม VAT 7% แล้ว",
}

export function ExpenseLineDialog({
  open,
  initial,
  types,
  costCenters,
  units,
  assets,
  lockFinancials = false,
  onClose,
  onSave,
}: {
  open: boolean
  initial: LineDraft
  types: ExpenseTypeOption[]
  costCenters: CostCenterRow[]
  units: UnitOption[]
  assets: AssetOption[]
  lockFinancials?: boolean
  onClose: () => void
  onSave: (draft: LineDraft) => void
}) {
  const [draft, setDraft] = useState<LineDraft>(initial)
  const [error, setError] = useState<string | null>(null)

  const hasSourceAmount = Boolean(draft.sourceAmountLocked)
  const selectedType = types.find((t) => t.id === draft.expenseTypeId)
  const legacy = isLegacyUnrestricted(selectedType)

  const preview = useMemo(() => computeLineAmount(draft), [draft])
  const net = useMemo(() => computeLineNet(draft, lockFinancials), [draft, lockFinancials])
  const tax = useMemo(() => computeLineTax(draft, lockFinancials), [draft, lockFinancials])
  const legacyTax =
    !lockFinancials && initial.taxMode === "NONE" && draft.taxMode === "NONE" ? Number(initial.taxAmount) || 0 : 0

  const showCostCenter = Boolean(selectedType?.requiresCostCenter || draft.costCenterId || legacy)
  const showMachine = Boolean(selectedType?.requiresMachine)
  const showLocation = Boolean(selectedType?.requiresLocation)
  const showAsset = !showMachine && !showLocation

  const ccChoices = costCenterOptions(selectedType, costCenters, draft.costCenterId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [assetOpen, setAssetOpen] = useState(false)
  const [assetQuery, setAssetQuery] = useState("")
  const assetMatches = useMemo(() => {
    const q = assetQuery.trim().toLowerCase()
    return assets.filter((a) => !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
  }, [assets, assetQuery])
  const selectedAsset = assets.find((a) => a.id === draft.costObjectId)
  const assetText = selectedAsset
    ? `${selectedAsset.code} — ${selectedAsset.name}`
    : draft.costObjectLabel.trim()
      ? `${draft.costObjectType && draft.costObjectType !== "VEHICLE" ? `${COST_OBJECT_TYPE_LABELS[draft.costObjectType] ?? draft.costObjectType} · ` : ""}${draft.costObjectLabel.trim()}`
      : "— ไม่ระบุ —"
  const [pickerCategoryKey, setPickerCategoryKey] = useState<string | null>(() =>
    defaultExpenseCategoryKey(types, initial.expenseTypeId)
  )
  const [activeField, setActiveField] = useState<MoneyField>(
    initial.pricingMode === "QTY_PRICE" ? "unitPrice" : "amount"
  )
  const [replaceNext, setReplaceNext] = useState(true)

  function set<K extends keyof LineDraft>(field: K, value: LineDraft[K]) {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  function changeType(typeId: string) {
    const type = types.find((t) => t.id === typeId)
    setDraft((d) => applyTypeChange(d, type))
  }

  function fieldLocked(): boolean {
    return lockFinancials
  }

  function fieldMax(field: MoneyField): number | undefined {
    return field === "discountAmount" && draft.discountKind === "PERCENT" ? 100 : undefined
  }

  function focusField(field: MoneyField) {
    setActiveField(field)
    setReplaceNext(true)
  }

  function onMoneyInput(field: MoneyField, raw: string) {
    set(field, sanitizeDecimal(raw, field === "quantity" ? 3 : 2, fieldMax(field)))
    setReplaceNext(false)
  }

  function pressKey(key: string) {
    if (fieldLocked()) return
    const next = typeDigit(draft[activeField], key, activeField === "quantity" ? 3 : 2, replaceNext)
    if (next === null) return
    const max = fieldMax(activeField)
    if (max != null && Number(next) > max) return
    set(activeField, next)
    setReplaceNext(false)
  }

  const boxClass = (field: MoneyField) =>
    cn(
      "flex items-center rounded-xl border bg-background px-3",
      activeField === field && !fieldLocked() ? "border-[#2563eb] ring-2 ring-[#2563eb]" : "border-border",
      fieldLocked() && "bg-muted"
    )

  function moneyBox(field: MoneyField, suffix: string | null, size: "md" | "lg" = "lg", ariaLabel?: string) {
    return (
      <div className={boxClass(field)}>
        <input
          inputMode="decimal"
          aria-label={ariaLabel}
          value={draft[field]}
          disabled={fieldLocked()}
          onFocus={() => focusField(field)}
          onChange={(e) => onMoneyInput(field, e.target.value)}
          className={cn(
            "w-full bg-transparent font-medium text-foreground outline-none disabled:cursor-not-allowed",
            size === "lg" ? "py-2.5 text-lg" : "py-2 text-base"
          )}
        />
        {suffix && <span className="shrink-0 text-sm text-foreground">{suffix}</span>}
      </div>
    )
  }

  function changeUnit(unitId: string) {
    const unit = units.find((u) => u.id === unitId)
    setDraft((d) => ({ ...d, unitId, unitCode: unit?.code ?? "" }))
  }

  function changePricingMode(mode: LineDraft["pricingMode"]) {
    setDraft((d) =>
      mode === "AMOUNT"
        ? { ...d, pricingMode: mode, unitId: "", unitCode: "", quantity: "1" }
        : { ...d, pricingMode: mode }
    )
    focusField(mode === "QTY_PRICE" ? "unitPrice" : "amount")
  }

  function submit() {
    if (!draft.expenseTypeId) {
      setError("กรุณาเลือกประเภทค่าใช้จ่าย")
      return
    }
    if (!lockFinancials && draft.pricingMode === "AMOUNT" && !(Number(draft.amount) > 0)) {
      setError("กรุณาระบุจำนวนเงิน")
      return
    }
    if (!lockFinancials && draft.pricingMode === "QTY_PRICE" && !(preview > 0)) {
      setError("จำนวนและราคาต่อหน่วยต้องมากกว่า 0")
      return
    }
    if (draft.discountKind === "PERCENT") {
      const pct = Number(draft.discountAmount) || 0
      if (pct < 0 || pct > 100) {
        setError("ส่วนลดเป็นเปอร์เซ็นต์ต้องอยู่ระหว่าง 0–100")
        return
      }
    }
    const dimErr = validateLineDraft(draft, selectedType, { locked: lockFinancials })
    if (dimErr) {
      setError(dimErr)
      return
    }
    setError(null)
    onSave(draft)
  }

  function setDiscountKind(kind: DiscountKind) {
    if (kind === draft.discountKind) return
    const baht = computeDiscountBaht(draft)
    const amount = computeLineAmount(draft)
    if (kind === "PERCENT") {
      const pct = amount > 0 ? round2((baht / amount) * 100) : 0
      setDraft((d) => ({ ...d, discountKind: kind, discountAmount: pct ? String(pct) : "" }))
    } else {
      setDraft((d) => ({ ...d, discountKind: kind, discountAmount: baht ? String(baht) : "" }))
    }
    focusField("discountAmount")
  }

  return (
    <>
    <GlassDialog
      open={open}
      onOpenChange={(o) => !o && !pickerOpen && !assetOpen && onClose()}
      title="บันทึกรายการค่าใช้จ่าย"
      className="max-w-4xl"
      solid
    >
      <div className="space-y-5">
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-3">
        {lockFinancials && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            บิลจ่ายแล้ว — แก้ได้เฉพาะประเภท หน่วยงาน รายละเอียด และหน่วยนับ ยอดเงินถูกล็อก
          </p>
        )}
        {hasSourceAmount && !lockFinancials && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
            บรรทัดนี้ผูกจากต้นทาง ({sourceModuleLabel(draft.sourceModule)}) — ยอดอ้างอิงถูกใส่ให้แล้ว แก้จำนวนเงินได้เพื่อยืนยันยอดที่จ่ายจริง
          </p>
        )}
        {draft.sourceKind !== "MANUAL" && !hasSourceAmount && !lockFinancials && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
            บรรทัดนี้ผูกจากต้นทาง ({sourceModuleLabel(draft.sourceModule)}) — ยังไม่มียอดอ้างอิง ให้ Finance กรอกจำนวนเงินเอง
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 whitespace-nowrap text-base font-medium text-foreground">
              ประเภทค่าใช้จ่าย<span className="ml-1 text-red-500">*</span>
            </span>
            {selectedType?.defaultGlLabel && (
              <p className="min-w-0 truncate text-right text-xs text-foreground">
                บัญชีชั่วคราว (ยังไม่ผ่าน GL): {selectedType.defaultGlLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-left hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
              {selectedType?.name ?? "— เลือกประเภท —"}
            </span>
            <span className="shrink-0 text-xs font-medium text-blue-700 dark:text-blue-300">เปลี่ยนประเภท</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-foreground" />
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-nowrap items-center justify-between gap-3">
            <span className="shrink-0 whitespace-nowrap text-base font-medium text-foreground">จำนวนเงิน</span>
            {!lockFinancials && (
              <div className="inline-flex shrink-0 flex-nowrap rounded-lg bg-muted p-1">
                {(["AMOUNT", "QTY_PRICE"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => changePricingMode(mode)}
                    className={cn(
                      "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                      draft.pricingMode === mode ? "bg-[#2563eb] text-white" : "text-foreground hover:bg-background"
                    )}
                  >
                    {PRICING_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {draft.pricingMode === "QTY_PRICE" ? (
            <div className="grid items-end gap-2 sm:grid-cols-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-foreground">จำนวน</span>
                {moneyBox("quantity", null, "md")}
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-foreground">
                  หน่วย<span className="ml-0.5 text-red-500">*</span>
                </span>
                <Select
                  id="expense-line-unit"
                  aria-label="หน่วย"
                  required
                  value={draft.unitId}
                  onChange={(e) => changeUnit(e.target.value)}
                  placeholder="— เลือกหน่วย —"
                  className="h-10 rounded-xl py-0 text-base font-medium leading-10"
                  options={[
                    ...units.filter((u) => u.isActive || u.id === draft.unitId).map((u) => ({
                      value: u.id,
                      label: `${u.name} (${u.code})`,
                    })),
                    ...(draft.unitId && !units.some((u) => u.id === draft.unitId)
                      ? [{ value: draft.unitId, label: draft.unitCode || draft.unitId }]
                      : []),
                  ]}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-foreground">ราคา/หน่วย</span>
                {moneyBox("unitPrice", "บาท", "md")}
              </label>
            </div>
          ) : (
            moneyBox("amount", "บาท", "lg", "จำนวนเงิน")
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-nowrap items-center justify-between gap-3">
            <span className="shrink-0 whitespace-nowrap text-base font-medium text-foreground">ส่วนลด (ถ้ามี)</span>
            {!lockFinancials && (
              <div className="inline-flex shrink-0 flex-nowrap rounded-lg bg-muted p-1" role="group" aria-label="หน่วยส่วนลด">
                {(["BAHT", "PERCENT"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={draft.discountKind === kind}
                    onClick={() => setDiscountKind(kind)}
                    className={cn(
                      "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                      draft.discountKind === kind ? "bg-[#2563eb] text-white" : "text-foreground hover:bg-background"
                    )}
                  >
                    {kind === "BAHT" ? "บาท" : "%"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {moneyBox("discountAmount", draft.discountKind === "PERCENT" ? "%" : "บาท", "lg", "ส่วนลด")}
          {draft.discountKind === "PERCENT" && Number(draft.discountAmount) > 0 && (
            <p className="text-sm text-foreground">คิดเป็น {formatBaht(computeDiscountBaht(draft))}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <span className="shrink-0 whitespace-nowrap text-base font-medium text-foreground">ภาษี</span>
            {lockFinancials ? (
              <span className="text-sm font-medium text-foreground">{TAX_MODE_LABELS[draft.taxMode]}</span>
            ) : (
              <div className="inline-flex shrink-0 flex-nowrap rounded-lg bg-muted p-1" role="group" aria-label="ภาษี">
                {TAX_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={draft.taxMode === mode}
                    onClick={() => set("taxMode", mode)}
                    className={cn(
                      "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                      draft.taxMode === mode ? "bg-[#2563eb] text-white" : "text-foreground hover:bg-background"
                    )}
                  >
                    {TAX_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(draft.taxMode !== "NONE" || tax > 0) && (
            <p className="text-sm text-foreground">
              {draft.taxMode === "VAT_INCLUSIVE" ? "ภาษีที่รวมอยู่" : "ภาษี"} {formatBaht(tax)}
            </p>
          )}
          {legacyTax > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              บรรทัดนี้เคยกรอกภาษี {formatBaht(legacyTax)} เอง ถ้าบันทึกเป็น ไม่มี ภาษีจะเป็น 0 — เลือก VAT ถ้าบิลมีภาษี
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <Coins className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-blue-800">สุทธิ</p>
              <p className="text-xs text-blue-800">
                ({lockFinancials && draft.taxMode === "NONE" && tax > 0 ? "จำนวนเงิน − ส่วนลด + ภาษี" : NET_HINTS[draft.taxMode]})
              </p>
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums text-blue-700">{formatBaht(net)}</p>
        </div>

        {(showCostCenter || showAsset) && (
          <div className="grid grid-cols-2 gap-3">
            {showCostCenter && (
              <Select
                label="หน่วยงาน (Cost Center)"
                required={Boolean(selectedType?.requiresCostCenter)}
                value={draft.costCenterId}
                onChange={(e) => set("costCenterId", e.target.value)}
                options={[
                  { value: "", label: selectedType?.requiresCostCenter ? "— เลือกหน่วยงาน —" : "— ไม่ระบุ —" },
                  ...ccChoices.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            )}
            {showAsset && (
              <div className="min-w-0 space-y-1.5">
                <span className="block text-sm font-medium text-foreground">สินทรัพย์</span>
                <button
                  type="button"
                  disabled={lockFinancials}
                  onClick={() => {
                    setAssetQuery("")
                    setAssetOpen(true)
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm text-foreground hover:border-slate-400 disabled:cursor-not-allowed disabled:bg-muted"
                >
                  <span className="min-w-0 truncate">{assetText}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        )}

        {showMachine && (
          <GlassInput
            label="เครื่องจักร"
            required={Boolean(selectedType?.requiresMachine)}
            value={draft.costObjectLabel}
            onChange={(e) => setDraft((d) => ({ ...d, costObjectType: "MACHINE", costObjectLabel: e.target.value }))}
            placeholder="ชื่อเครื่องจักร"
            disabled={lockFinancials}
          />
        )}
        {showLocation && (
          <GlassInput
            label="สถานที่"
            required={Boolean(selectedType?.requiresLocation)}
            value={draft.costObjectLabel}
            onChange={(e) => setDraft((d) => ({ ...d, costObjectType: "LOCATION", costObjectLabel: e.target.value }))}
            placeholder="สถานที่ / สาขา / ไซต์งาน"
            disabled={lockFinancials}
          />
        )}

        </div>

        <div className="min-w-0 space-y-2">
          {!lockFinancials && (
            <>
              <div className="rounded-xl bg-muted px-4 py-3">
                <p className="text-sm font-medium text-foreground">กดตัวเลข</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <span className="min-w-0 truncate text-3xl font-semibold tabular-nums text-foreground">
                    {draft[activeField] || "0"}
                  </span>
                  <span className="pb-1 text-sm text-foreground">
                    {activeField === "quantity"
                      ? ""
                      : activeField === "discountAmount" && draft.discountKind === "PERCENT"
                        ? "%"
                        : "บาท"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {PAD_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={key === "back" ? "ลบตัวเลข" : key}
                    disabled={fieldLocked()}
                    onClick={() => pressKey(key)}
                    className="inline-flex min-h-14 items-center justify-center rounded-xl border border-border bg-background text-xl font-semibold text-foreground shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {key === "back" ? <Delete className="h-5 w-5" /> : key}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <span className="block whitespace-nowrap text-base font-medium text-foreground">รายละเอียด</span>
            <Input
              value={draft.description}
              placeholder="รายละเอียดบรรทัดนี้"
              onChange={(e) => set("description", e.target.value)}
              className="py-2.5 text-base"
            />
          </div>
          <div className="space-y-2 pt-2">
            <Button
              type="button"
              size="lg"
              className="h-16 w-full bg-[#2563eb] px-6 text-lg font-semibold text-white hover:bg-[#1d4ed8]"
              icon={<Check className="h-5 w-5" />}
              onClick={submit}
            >
              บันทึกบรรทัด
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-16 w-full border border-slate-300 bg-[#e2e8f0] px-6 text-lg font-semibold text-[#0f172a] hover:bg-[#cbd5e1]"
              onClick={onClose}
            >
              ยกเลิก
            </Button>
          </div>
        </div>
      </div>
      </div>
    </GlassDialog>

    <GlassDialog
      open={open && pickerOpen}
      onOpenChange={setPickerOpen}
      title="เลือกหมวดและประเภทค่าใช้จ่าย"
      className="max-w-6xl"
      solid
    >
      <ExpenseTypePicker
        types={types}
        categoryKey={pickerCategoryKey}
        typeId={draft.expenseTypeId}
        onPickCategory={setPickerCategoryKey}
        onPickType={(id) => {
          changeType(id)
          setError(null)
          setPickerOpen(false)
        }}
      />
    </GlassDialog>

    <GlassDialog open={open && assetOpen} onOpenChange={setAssetOpen} title="เลือกสินทรัพย์" className="max-w-md" solid>
      <div className="space-y-3">
        <Input
          autoFocus
          value={assetQuery}
          placeholder="ค้นหารหัสหรือชื่อ"
          onChange={(e) => setAssetQuery(e.target.value)}
          className="py-2.5 text-base"
        />
        <div className="max-h-80 space-y-1 overflow-y-auto" role="listbox" aria-label="สินทรัพย์">
          <button
            type="button"
            onClick={() => {
              setDraft((d) => ({
                ...d,
                costObjectType: selectedType?.requiresVehicle ? "VEHICLE" : "",
                costObjectId: "",
                costObjectLabel: "",
              }))
              setAssetOpen(false)
            }}
            className="flex w-full rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted"
          >
            — ไม่ระบุ —
          </button>
          {assetMatches.map((asset) => {
              const selected = asset.id === draft.costObjectId
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({
                      ...d,
                      costObjectType: "VEHICLE",
                      costObjectId: asset.id,
                      costObjectLabel: `${asset.code} — ${asset.name}`,
                    }))
                    setAssetOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-baseline gap-2 rounded-lg px-3 py-2.5 text-left text-sm",
                    selected ? "bg-[#2563eb] text-white" : "text-foreground hover:bg-muted"
                  )}
                >
                  <span className="shrink-0 font-medium">{asset.code}</span>
                  <span className="min-w-0 truncate">{asset.name}</span>
                </button>
              )
            })}
          {assetMatches.length === 0 && <p className="px-3 py-6 text-center text-sm text-foreground">ไม่พบสินทรัพย์</p>}
        </div>
      </div>
    </GlassDialog>
    </>
  )
}
