"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { GlassDialog, GlassInput } from "@/components/glass"
import { cn } from "@/lib/utils"
import type { CostCenterRow, DiscountKind, ExpenseTypeOption, LineDraft, ProcessRow, UnitOption } from "./expense-types"
import {
  applyTypeChange,
  costCenterOptions,
  isLegacyUnrestricted,
  processOptions,
  validateLineDraft,
} from "./expense-form-validation"
import {
  COST_OBJECT_TYPE_LABELS,
  PRICING_MODE_LABELS,
  formatBaht,
  sourceModuleLabel,
} from "./finance-theme"

const COST_OBJECT_TYPES = ["VEHICLE", "MACHINE", "TIRE", "JOB", "CUSTOMER", "PRODUCT", "PROJECT", "LOCATION", "OTHER"]
const UNCATEGORIZED = "__none__"

function typeGroups(types: ExpenseTypeOption[], keepId: string) {
  const map = new Map<string, { key: string; label: string; items: ExpenseTypeOption[] }>()
  for (const t of types) {
    if (!t.isActive && t.id !== keepId) continue
    const key = t.categoryId ?? UNCATEGORIZED
    const label = t.categoryName?.trim() || "อื่นๆ"
    const g = map.get(key) ?? { key, label, items: [] }
    g.items.push(t)
    map.set(key, g)
  }
  return [...map.values()]
}

export function newLineDraft(): LineDraft {
  return {
    key: `line-${Math.random().toString(36).slice(2, 10)}`,
    expenseTypeId: "",
    description: "",
    pricingMode: "QTY_PRICE",
    quantity: "1",
    unitId: "",
    unitCode: "",
    unitPrice: "",
    amount: "",
    taxAmount: "",
    discountAmount: "",
    discountKind: "BAHT",
    costCenterId: "",
    processId: "",
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

export function computeLineNet(draft: LineDraft): number {
  const amount = computeLineAmount(draft)
  const tax = Number(draft.taxAmount) || 0
  const discount = computeDiscountBaht(draft)
  const net = amount + tax - discount
  return net < 0 ? 0 : round2(net)
}

export function ExpenseLineDialog({
  open,
  initial,
  types,
  costCenters,
  processes,
  units,
  lockFinancials = false,
  onClose,
  onSave,
}: {
  open: boolean
  initial: LineDraft
  types: ExpenseTypeOption[]
  costCenters: CostCenterRow[]
  processes: ProcessRow[]
  units: UnitOption[]
  lockFinancials?: boolean
  onClose: () => void
  onSave: (draft: LineDraft) => void
}) {
  const [draft, setDraft] = useState<LineDraft>(initial)
  const [error, setError] = useState<string | null>(null)

  const locked = Boolean(draft.sourceAmountLocked)
  const financialLocked = locked || lockFinancials
  const selectedType = types.find((t) => t.id === draft.expenseTypeId)
  const legacy = isLegacyUnrestricted(selectedType)

  const preview = useMemo(() => computeLineAmount(draft), [draft])
  const net = useMemo(() => computeLineNet(draft), [draft])

  const showCostCenter = Boolean(selectedType?.requiresCostCenter || draft.costCenterId || legacy)
  const showProcess = Boolean(selectedType?.requiresProcess || draft.processId)
  const showVehicle = Boolean(selectedType?.requiresVehicle || draft.costObjectType === "VEHICLE")
  const showMachine = Boolean(selectedType?.requiresMachine || draft.costObjectType === "MACHINE")
  const showLocation = Boolean(selectedType?.requiresLocation || draft.costObjectType === "LOCATION")
  const showGenericCostObject =
    legacy && !selectedType?.requiresVehicle && !selectedType?.requiresMachine && !selectedType?.requiresLocation

  const ccChoices = costCenterOptions(selectedType, costCenters, draft.costCenterId)
  const processChoices = processOptions(selectedType, processes, draft.processId)
  const groups = useMemo(() => typeGroups(types, draft.expenseTypeId), [types, draft.expenseTypeId])
  const [categoryKey, setCategoryKey] = useState(
    () => types.find((t) => t.id === initial.expenseTypeId)?.categoryId ?? groups[0]?.key ?? UNCATEGORIZED
  )

  useEffect(() => {
    setCategoryKey((current) => {
      const fromType = types.find((t) => t.id === draft.expenseTypeId)?.categoryId ?? UNCATEGORIZED
      if (draft.expenseTypeId && groups.some((g) => g.key === fromType)) return fromType
      if (groups.some((g) => g.key === current)) return current
      return groups[0]?.key ?? UNCATEGORIZED
    })
  }, [draft.expenseTypeId, types, groups])

  const visibleTypes = groups.find((g) => g.key === categoryKey)?.items ?? groups[0]?.items ?? []

  function set<K extends keyof LineDraft>(field: K, value: LineDraft[K]) {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  function changeType(typeId: string) {
    const type = types.find((t) => t.id === typeId)
    setDraft((d) => applyTypeChange(d, type))
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
  }

  function submit() {
    if (!draft.expenseTypeId) {
      setError("กรุณาเลือกประเภทค่าใช้จ่าย")
      return
    }
    if (!financialLocked && draft.pricingMode === "AMOUNT" && !(Number(draft.amount) > 0)) {
      setError("กรุณาระบุจำนวนเงิน")
      return
    }
    if (!financialLocked && draft.pricingMode === "QTY_PRICE" && !(preview > 0)) {
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
    const dimErr = validateLineDraft(draft, selectedType, { locked: financialLocked })
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
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="รายการค่าใช้จ่าย (บรรทัด)"
      className="max-w-5xl"
    >
      <div className="-mx-5 -my-4 flex min-h-[28rem] flex-col md:max-h-[calc(85vh-4.5rem)] md:flex-row">
        <aside className="flex w-full shrink-0 flex-col bg-slate-800 p-3 text-white md:w-[22rem] lg:w-[26rem] dark:bg-slate-950">
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
            ประเภทค่าใช้จ่าย <span className="text-red-400">*</span>
          </p>
          {groups.length > 1 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setCategoryKey(g.key)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    categoryKey === g.key
                      ? "bg-emerald-500 text-white"
                      : "bg-white/10 text-slate-200 hover:bg-white/20"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
          <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto pr-0.5">
            {visibleTypes.map((t) => {
              const selected = draft.expenseTypeId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    changeType(t.id)
                    setError(null)
                  }}
                  className={cn(
                    "flex min-h-[4.5rem] items-center justify-center rounded-xl px-2 py-2 text-center text-xs font-semibold leading-snug shadow-sm",
                    selected
                      ? "bg-emerald-500 text-white ring-2 ring-emerald-300"
                      : "bg-white text-slate-800 hover:bg-emerald-50 dark:bg-white dark:text-slate-800"
                  )}
                >
                  {t.name}
                </button>
              )
            })}
            {visibleTypes.length === 0 && (
              <p className="col-span-3 py-8 text-center text-sm text-slate-400">ไม่มีประเภทในหมวดนี้</p>
            )}
          </div>
        </aside>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {lockFinancials && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            บิลจ่ายแล้ว — แก้ได้เฉพาะประเภท หน่วยงาน กระบวนการ รายละเอียด และหน่วยนับ ยอดเงินถูกล็อก
          </p>
        )}
        {locked && !lockFinancials && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            บรรทัดนี้ผูกจากต้นทาง ({sourceModuleLabel(draft.sourceModule)}) — จำนวน/ราคา/ยอดถูกล็อกจากเอกสารต้นทาง แก้ได้เฉพาะประเภท หน่วยงาน กระบวนการ วัตถุต้นทุน และรายละเอียด
          </p>
        )}
        {draft.sourceKind !== "MANUAL" && !locked && !lockFinancials && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
            บรรทัดนี้ผูกจากต้นทาง ({sourceModuleLabel(draft.sourceModule)}) — ยังไม่มียอดอ้างอิง ให้ Finance กรอกจำนวนเงินเอง
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
          <span className="text-xs text-muted-foreground">ประเภทที่เลือก</span>
          <p className="font-medium text-foreground">{selectedType?.name ?? "— กดปุ่มด้านซ้ายเพื่อเลือก —"}</p>
        </div>
        {selectedType?.defaultGlLabel && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/5">
            บัญชีชั่วคราว (ยังไม่ผ่าน GL): {selectedType.defaultGlLabel}
          </p>
        )}

        <GlassInput
          label="รายละเอียด"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="รายละเอียดบรรทัดนี้"
        />

        {!locked && !lockFinancials && (
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">วิธีคิดเงิน</span>
            <div className="inline-flex rounded-xl border border-slate-200/80 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5">
              {(["QTY_PRICE", "AMOUNT"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => changePricingMode(mode)}
                  className={
                    draft.pricingMode === mode
                      ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow"
                      : "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                  }
                >
                  {PRICING_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>
        )}

        {draft.pricingMode === "QTY_PRICE" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <GlassInput
              label="จำนวน"
              type="number"
              min={0}
              step="0.001"
              value={draft.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              disabled={financialLocked}
            />
            <Select
              label="หน่วย"
              required
              value={draft.unitId}
              onChange={(e) => changeUnit(e.target.value)}
              placeholder="— เลือกหน่วย —"
              disabled={locked && !lockFinancials}
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
            <GlassInput
              label="ราคา/หน่วย"
              type="number"
              min={0}
              step="0.01"
              value={draft.unitPrice}
              onChange={(e) => set("unitPrice", e.target.value)}
              disabled={financialLocked}
            />
          </div>
        ) : (
          <GlassInput
            label="จำนวนเงิน"
            type="number"
            min={0}
            step="0.01"
            value={draft.amount}
            onChange={(e) => set("amount", e.target.value)}
            disabled={financialLocked}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <GlassInput
            label="ภาษี"
            type="number"
            min={0}
            step="0.01"
            value={draft.taxAmount}
            onChange={(e) => set("taxAmount", e.target.value)}
            disabled={lockFinancials}
          />
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">ส่วนลด</span>
            <div className="flex gap-2">
              <GlassInput
                type="number"
                min={0}
                max={draft.discountKind === "PERCENT" ? 100 : undefined}
                step="0.01"
                value={draft.discountAmount}
                onChange={(e) => set("discountAmount", e.target.value)}
                className="flex-1"
                disabled={lockFinancials}
              />
              <div className="inline-flex shrink-0 self-end rounded-xl border border-slate-200/80 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5">
                {(["BAHT", "PERCENT"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => !lockFinancials && setDiscountKind(kind)}
                    className={
                      draft.discountKind === kind
                        ? "rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white shadow"
                        : "rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    }
                  >
                    {kind === "BAHT" ? "บาท" : "%"}
                  </button>
                ))}
              </div>
            </div>
            {draft.discountKind === "PERCENT" && Number(draft.discountAmount) > 0 && (
              <p className="text-xs text-muted-foreground">คิดเป็น {formatBaht(computeDiscountBaht(draft))}</p>
            )}
          </div>
        </div>

        {(showCostCenter || showProcess) && (
          <div className="grid gap-3 sm:grid-cols-2">
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
            {showProcess && (
              <Select
                label="กระบวนการ"
                required={Boolean(selectedType?.requiresProcess)}
                value={draft.processId}
                onChange={(e) => set("processId", e.target.value)}
                options={[
                  { value: "", label: selectedType?.requiresProcess ? "— เลือกกระบวนการ —" : "— ไม่ระบุ —" },
                  ...processChoices.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            )}
          </div>
        )}

        {showGenericCostObject && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="ประเภทวัตถุต้นทุน"
              value={draft.costObjectType}
              onChange={(e) => set("costObjectType", e.target.value)}
              disabled={lockFinancials}
              options={[
                { value: "", label: "— ไม่ระบุ —" },
                ...COST_OBJECT_TYPES.map((t) => ({ value: t, label: COST_OBJECT_TYPE_LABELS[t] ?? t })),
              ]}
            />
            <GlassInput
              label="วัตถุต้นทุน (ป้าย)"
              value={draft.costObjectLabel}
              onChange={(e) => set("costObjectLabel", e.target.value)}
              placeholder="เช่น ทะเบียนรถ / ชื่อเครื่องจักร"
              disabled={lockFinancials}
            />
          </div>
        )}

        {showVehicle && !showGenericCostObject && (
          <GlassInput
            label="รถ"
            required={Boolean(selectedType?.requiresVehicle)}
            value={draft.costObjectLabel}
            onChange={(e) => setDraft((d) => ({ ...d, costObjectType: "VEHICLE", costObjectLabel: e.target.value }))}
            placeholder="ทะเบียนรถ / ชื่อรถ"
            disabled={lockFinancials}
          />
        )}
        {showMachine && !showGenericCostObject && (
          <GlassInput
            label="เครื่องจักร"
            required={Boolean(selectedType?.requiresMachine)}
            value={draft.costObjectLabel}
            onChange={(e) => setDraft((d) => ({ ...d, costObjectType: "MACHINE", costObjectLabel: e.target.value }))}
            placeholder="ชื่อเครื่องจักร"
            disabled={lockFinancials}
          />
        )}
        {showLocation && !showGenericCostObject && (
          <GlassInput
            label="สถานที่"
            required={Boolean(selectedType?.requiresLocation)}
            value={draft.costObjectLabel}
            onChange={(e) => setDraft((d) => ({ ...d, costObjectType: "LOCATION", costObjectLabel: e.target.value }))}
            placeholder="สถานที่ / สาขา / ไซต์งาน"
            disabled={lockFinancials}
          />
        )}

        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <span className="text-muted-foreground">
            จำนวนเงิน {formatBaht(preview)} · สุทธิ
          </span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatBaht(net)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={submit}>
            บันทึกบรรทัด
          </Button>
        </div>
        </div>
      </div>
    </GlassDialog>
  )
}
