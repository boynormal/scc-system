"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Check, ChevronRight, Coins, Delete, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { GlassDialog } from "@/components/glass"
import { cn } from "@/lib/utils"
import type { UnitOption } from "./expense-types"
import { formatBaht } from "./finance-theme"
import { INCOME_VAT_RATE, type IncomeCategoryRow, type IncomeLineDraft, type IncomeTaxMode, type IncomeTypeOption } from "./income-types"
import { IncomeTypePicker, defaultIncomeCategoryId } from "./income-type-picker"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function newIncomeLineDraft(): IncomeLineDraft {
  return {
    key: `line-${Math.random().toString(36).slice(2, 10)}`,
    incomeTypeId: "",
    description: "",
    pricingMode: "AMOUNT",
    quantity: "1",
    unitId: "",
    unitPrice: "",
    amount: "",
    taxAmount: "",
    discountAmount: "",
    costCenterId: "",
  }
}

export function incomeLineAmount(d: Pick<IncomeLineDraft, "pricingMode" | "quantity" | "unitPrice" | "amount">): number {
  if (d.pricingMode === "QTY_PRICE") return round2((Number(d.quantity) || 0) * (Number(d.unitPrice) || 0))
  return round2(Number(d.amount) || 0)
}

/** Mirrors computeIncomeLineAmounts on the server so the cart shows what will be saved. */
export function incomeLineMoney(
  d: IncomeLineDraft,
  taxMode: IncomeTaxMode = "NONE"
): { amount: number; discount: number; tax: number; net: number } {
  const amount = incomeLineAmount(d)
  const discount = round2(Number(d.discountAmount) || 0)
  if (taxMode !== "NONE") {
    const base = Math.max(0, round2(amount - discount))
    const tax =
      taxMode === "VAT_EXCLUSIVE" ? round2(base * INCOME_VAT_RATE) : round2((base * INCOME_VAT_RATE) / (1 + INCOME_VAT_RATE))
    return { amount, discount, tax, net: taxMode === "VAT_EXCLUSIVE" ? round2(base + tax) : base }
  }
  const tax = round2(Number(d.taxAmount) || 0)
  const net = amount + tax - discount
  return { amount, discount, tax, net: net < 0 ? 0 : round2(net) }
}

export function incomeLineNet(d: IncomeLineDraft, taxMode: IncomeTaxMode = "NONE"): number {
  return incomeLineMoney(d, taxMode).net
}

type DiscountChoice = "none" | "5" | "10" | "custom" | "baht"
type MoneyField = "amount" | "quantity" | "unitPrice" | "discount" | "discountBaht"

function inferDiscount(amount: number, discountBaht: number): { choice: DiscountChoice; percent: string; baht: string } {
  if (!(discountBaht > 0)) return { choice: "baht", percent: "", baht: "" }
  const pct = amount > 0 ? round2((discountBaht / amount) * 100) : 0
  if (Math.abs(pct - 5) < 0.05) return { choice: "custom", percent: "5", baht: "" }
  if (Math.abs(pct - 10) < 0.05) return { choice: "custom", percent: "10", baht: "" }
  return { choice: "baht", percent: "", baht: String(discountBaht) }
}

function discountFromChoice(amount: number, choice: DiscountChoice, percent: string, baht: string): number {
  if (choice === "5") return round2(amount * 0.05)
  if (choice === "10") return round2(amount * 0.1)
  if (choice === "custom") return round2((amount * (Number(percent) || 0)) / 100)
  if (choice === "baht") return round2(Number(baht) || 0)
  return 0
}

function typeDigit(current: string, key: string, maxDecimals: number, replace: boolean): string | null {
  if (key === "clear") return ""
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
  let next = dot >= 0 ? `${whole}.${frac}` : whole
  if (maxValue != null && next !== "" && next !== "0." && Number(next) > maxValue) return String(maxValue)
  return next
}

const PAD_KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "back"] as const

export function IncomeLineDialog({
  open,
  initial,
  typeName,
  types,
  categories,
  units,
  taxMode = "NONE",
  lockFinancials = false,
  onClose,
  onSave,
}: {
  open: boolean
  initial: IncomeLineDraft
  typeName: string
  types: IncomeTypeOption[]
  categories: IncomeCategoryRow[]
  units: UnitOption[]
  taxMode?: IncomeTaxMode
  lockFinancials?: boolean
  onClose: () => void
  onSave: (draft: IncomeLineDraft) => void
}) {
  const t = useTranslations("financeIncome")
  const inferred = inferDiscount(incomeLineAmount(initial), Number(initial.discountAmount) || 0)
  const [draft, setDraft] = useState<IncomeLineDraft>(initial)
  const [choice, setChoice] = useState<DiscountChoice>(inferred.choice)
  const [discountPercent, setDiscountPercent] = useState(inferred.percent)
  const [discountBaht, setDiscountBaht] = useState(inferred.baht)
  const [activeField, setActiveField] = useState<MoneyField>(initial.pricingMode === "QTY_PRICE" ? "unitPrice" : "amount")
  const [replaceNext, setReplaceNext] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerCategoryId, setPickerCategoryId] = useState<string | null>(() => {
    const current = types.find((x) => x.id === initial.incomeTypeId)
    return current ? (current.categoryId ?? "") : defaultIncomeCategoryId(types, categories)
  })
  const amount = incomeLineAmount(draft)
  const discountValue = discountFromChoice(amount, choice, discountPercent, discountBaht)
  const net = incomeLineNet({ ...draft, discountAmount: String(discountValue) }, taxMode)

  function set<K extends keyof IncomeLineDraft>(field: K, value: IncomeLineDraft[K]) {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  function selectChoice(next: DiscountChoice) {
    if (lockFinancials) return
    setChoice(next)
    if (next === "custom") focusField("discount")
    else if (next === "baht") focusField("discountBaht")
    else if (activeField === "discount" || activeField === "discountBaht")
      focusField(draft.pricingMode === "QTY_PRICE" ? "unitPrice" : "amount")
  }

  function fieldText(field: MoneyField): string {
    if (field === "discount") return discountPercent
    if (field === "discountBaht") return discountBaht
    return draft[field]
  }

  function writeField(field: MoneyField, value: string) {
    if (field === "discount") {
      setDiscountPercent(value)
      return
    }
    if (field === "discountBaht") {
      setDiscountBaht(value)
      return
    }
    set(field, value)
  }

  function onMoneyInput(field: MoneyField, raw: string) {
    const maxDecimals = field === "quantity" ? 3 : 2
    writeField(field, sanitizeDecimal(raw, maxDecimals, field === "discount" ? 100 : undefined))
    setReplaceNext(false)
  }

  function focusField(field: MoneyField) {
    setActiveField(field)
    setReplaceNext(true)
  }

  function pressKey(key: string) {
    if (lockFinancials) return
    const maxDecimals = activeField === "quantity" ? 3 : 2
    const next = typeDigit(fieldText(activeField), key, maxDecimals, replaceNext)
    if (next === null) return
    if (activeField === "discount" && Number(next) > 100) return
    writeField(activeField, next)
    setReplaceNext(false)
  }

  const readout = fieldText(activeField)
  const readoutUnit = activeField === "discount" ? "%" : activeField === "quantity" ? "" : t("bahtUnit")
  const boxClass = (field: MoneyField) =>
    cn(
      "flex items-center rounded-xl border bg-background px-3",
      activeField === field ? "border-[#2563eb] ring-2 ring-[#2563eb]" : "border-border",
      lockFinancials && "bg-muted"
    )

  function submit() {
    if (!draft.incomeTypeId) return setError(t("errType"))
    if (!lockFinancials) {
      if (!(amount > 0)) return setError(draft.pricingMode === "QTY_PRICE" ? t("errQtyPrice") : t("errAmount"))
      if (draft.pricingMode === "QTY_PRICE" && !draft.unitId) return setError(t("errUnit"))
      const pct = Number(discountPercent) || 0
      if (choice === "custom" && (pct < 0 || pct > 100)) return setError(t("errDiscountPercent"))
      if (choice === "baht" && discountValue > amount) return setError(t("errDiscountBaht"))
    }
    setError(null)
    onSave({ ...draft, discountAmount: discountValue > 0 ? String(discountValue) : "" })
  }

  return (
    <>
    <GlassDialog
      open={open}
      onOpenChange={(o) => !o && !pickerOpen && onClose()}
      title={t("recordLine")}
      className="max-w-4xl"
      solid
    >
      <div className="space-y-5">
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-3">
          {lockFinancials && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{t("lineLocked")}</p>
          )}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="space-y-1.5">
            <span className="block whitespace-nowrap text-base font-medium text-foreground">{t("type")}</span>
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
                {types.find((x) => x.id === draft.incomeTypeId)?.name ?? typeName}
              </span>
              <span className="shrink-0 text-xs font-medium text-blue-700 dark:text-blue-300">{t("changeType")}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-foreground" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-nowrap items-center justify-between gap-3">
              <span className="shrink-0 whitespace-nowrap text-base font-medium text-foreground">{t("amount")}</span>
              {!lockFinancials && (
                <div className="inline-flex shrink-0 flex-nowrap rounded-lg bg-muted p-1">
                  {(["AMOUNT", "QTY_PRICE"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        set("pricingMode", mode)
                        focusField(mode === "QTY_PRICE" ? "unitPrice" : "amount")
                      }}
                      className={cn(
                        "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                        draft.pricingMode === mode ? "bg-[#2563eb] text-white" : "text-foreground hover:bg-background"
                      )}
                    >
                      {t(mode === "AMOUNT" ? "modeAmount" : "modeQtyPrice")}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {draft.pricingMode === "QTY_PRICE" ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-foreground">{t("quantity")}</span>
                  <div className={boxClass("quantity")}>
                    <input
                      inputMode="decimal"
                      value={draft.quantity}
                      disabled={lockFinancials}
                      onFocus={() => focusField("quantity")}
                      onChange={(e) => onMoneyInput("quantity", e.target.value)}
                      className="w-full bg-transparent py-2 text-base font-medium text-foreground outline-none disabled:cursor-not-allowed"
                    />
                  </div>
                </label>
                <Select
                  label={t("unit")}
                  required
                  value={draft.unitId}
                  onChange={(e) => set("unitId", e.target.value)}
                  placeholder={t("selectUnit")}
                  disabled={lockFinancials}
                  options={units
                    .filter((u) => u.isActive || u.id === draft.unitId)
                    .map((u) => ({ value: u.id, label: `${u.name} (${u.code})` }))}
                />
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-foreground">{t("unitPrice")}</span>
                  <div className={boxClass("unitPrice")}>
                    <input
                      inputMode="decimal"
                      value={draft.unitPrice}
                      disabled={lockFinancials}
                      onFocus={() => focusField("unitPrice")}
                      onChange={(e) => onMoneyInput("unitPrice", e.target.value)}
                      className="w-full bg-transparent py-2 text-base font-medium text-foreground outline-none disabled:cursor-not-allowed"
                    />
                    <span className="shrink-0 text-sm text-foreground">{t("bahtUnit")}</span>
                  </div>
                </label>
              </div>
            ) : (
              <div className={boxClass("amount")}>
                <input
                  inputMode="decimal"
                  value={draft.amount}
                  disabled={lockFinancials}
                  onFocus={() => focusField("amount")}
                  onChange={(e) => onMoneyInput("amount", e.target.value)}
                  className="w-full bg-transparent py-2.5 text-lg font-medium text-foreground outline-none disabled:cursor-not-allowed"
                />
                <span className="shrink-0 text-sm text-foreground">{t("bahtUnit")}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-nowrap items-center justify-between gap-3">
              <span className="shrink-0 whitespace-nowrap text-base font-medium text-foreground">{t("discountOptional")}</span>
              {!lockFinancials && (
                <div className="inline-flex shrink-0 flex-nowrap rounded-lg bg-muted p-1" role="group" aria-label={t("discountField")}>
                  {(["baht", "custom"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={choice === mode}
                      onClick={() => selectChoice(mode)}
                      className={cn(
                        "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                        choice === mode ? "bg-[#2563eb] text-white" : "text-foreground hover:bg-background"
                      )}
                    >
                      {t(mode === "baht" ? "discountBaht" : "discountPercent")}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={boxClass(choice === "custom" ? "discount" : "discountBaht")}>
              <input
                inputMode="decimal"
                aria-label={t("discountOptional")}
                value={choice === "custom" ? discountPercent : discountBaht}
                disabled={lockFinancials}
                onFocus={() => focusField(choice === "custom" ? "discount" : "discountBaht")}
                onChange={(e) => onMoneyInput(choice === "custom" ? "discount" : "discountBaht", e.target.value)}
                className="w-full bg-transparent py-2.5 text-lg font-medium text-foreground outline-none disabled:cursor-not-allowed"
              />
              <span className="shrink-0 text-sm text-foreground">{choice === "custom" ? "%" : t("bahtUnit")}</span>
            </div>
            {choice === "custom" && discountValue > 0 && (
              <p className="text-sm text-foreground">{t("discountEquals", { amount: formatBaht(discountValue) })}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Coins className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-blue-800">{t("netAmount")}</p>
                <p className="text-xs text-blue-800">({t("netAfterDiscount")})</p>
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums text-blue-700">{formatBaht(net)}</p>
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          {!lockFinancials && (
            <>
              <div className="rounded-xl bg-muted px-4 py-3">
                <p className="text-sm font-medium text-foreground">{t("keypad")}</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <span className="min-w-0 truncate text-3xl font-semibold tabular-nums text-foreground">{readout || "0"}</span>
                  {readoutUnit && <span className="pb-1 text-sm text-foreground">{readoutUnit}</span>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {PAD_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={key === "back" ? t("keypadBack") : key}
                    onClick={() => pressKey(key)}
                    className="inline-flex min-h-14 items-center justify-center rounded-xl border border-border bg-background text-xl font-semibold text-foreground shadow-sm hover:bg-muted"
                  >
                    {key === "back" ? <Delete className="h-5 w-5" /> : key}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <span className="block whitespace-nowrap text-base font-medium text-foreground">{t("lineDescription")}</span>
            <Input
              value={draft.description}
              placeholder={t("lineDescriptionPlaceholder")}
              onChange={(e) => set("description", e.target.value)}
              className="py-2.5 text-base"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          size="lg"
          className="h-16 w-56 border border-slate-300 bg-[#e2e8f0] px-6 text-lg font-semibold text-[#0f172a] hover:bg-[#cbd5e1]"
          onClick={onClose}
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          size="lg"
          className="h-16 w-56 bg-[#2563eb] px-6 text-lg font-semibold text-white hover:bg-[#1d4ed8]"
          icon={<Check className="h-5 w-5" />}
          onClick={submit}
        >
          {t("recordLine")}
        </Button>
      </div>
      </div>
    </GlassDialog>

    <GlassDialog open={open && pickerOpen} onOpenChange={setPickerOpen} title={t("pickTypeTitle")} className="max-w-3xl" solid>
      <IncomeTypePicker
        types={types}
        categories={categories}
        categoryId={pickerCategoryId}
        typeId={draft.incomeTypeId}
        disabled={false}
        onPickCategory={setPickerCategoryId}
        onPickType={(id) => {
          set("incomeTypeId", id)
          setError(null)
          setPickerOpen(false)
        }}
      />
    </GlassDialog>
    </>
  )
}
