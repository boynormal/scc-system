"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Banknote, CreditCard, Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { PageHeader } from "@/components/shell/page-header"
import { DataPanel } from "@/components/shell/data-panel"
import { AppDataTable, AppDataTableBody, AppDataTableHead } from "@/components/shell/app-data-table"
import type { Option, UnitOption } from "./expense-types"
import { formatBaht } from "./finance-theme"
import {
  INCOME_TAX_MODES,
  type IncomeCategoryRow,
  type IncomeDto,
  type IncomeLineDraft,
  type IncomeTaxMode,
  type IncomeTypeOption,
} from "./income-types"
import { IncomeLineDialog, incomeLineAmount, incomeLineMoney, incomeLineNet, newIncomeLineDraft } from "./income-line-dialog"
import { IncomeTypePicker, defaultIncomeCategoryId } from "./income-type-picker"
import { IncomePrintButtons } from "./income-print-buttons"

function todayYmdBangkok() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
}

function itemToDrafts(item: IncomeDto): IncomeLineDraft[] {
  return item.lines.map((l) => ({
    key: l.id,
    id: l.id,
    incomeTypeId: l.incomeTypeId,
    description: l.description ?? "",
    pricingMode: l.pricingMode,
    quantity: String(l.quantity),
    unitId: l.unitId ?? "",
    unitPrice: String(l.unitPrice),
    amount: String(l.amount),
    taxAmount: l.taxAmount ? String(l.taxAmount) : "",
    discountAmount: l.discountAmount ? String(l.discountAmount) : "",
    costCenterId: l.costCenterId ?? "",
    processId: l.processId ?? "",
  }))
}

function errorText(json: { error?: unknown }, fallback: string): string {
  if (typeof json.error === "string" && json.error.trim()) return json.error
  if (json.error && typeof json.error === "object" && "message" in json.error) {
    const m = (json.error as { message?: unknown }).message
    if (typeof m === "string" && m.trim()) return m
  }
  return fallback
}

export function IncomeFormPage({ item }: { item?: IncomeDto }) {
  const t = useTranslations("financeIncome")
  const router = useRouter()
  const received = item?.status === "RECEIVED"

  const [branches, setBranches] = useState<Option[]>([])
  const [employees, setEmployees] = useState<Option[]>([])
  const [types, setTypes] = useState<IncomeTypeOption[]>([])
  const [categories, setCategories] = useState<IncomeCategoryRow[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])

  const [branchId, setBranchId] = useState(item?.branchId ?? "")
  const [incomeDate, setIncomeDate] = useState(item?.incomeDate ?? todayYmdBangkok())
  const [postingDate, setPostingDate] = useState(item?.postingDate ?? item?.incomeDate ?? todayYmdBangkok())
  const [payerName, setPayerName] = useState(item?.payerName ?? "")
  const [employeeId, setEmployeeId] = useState(item?.employeeId ?? "")
  const [paymentMethod, setPaymentMethod] = useState<string>(item?.paymentMethod || "cash")
  const [taxMode, setTaxMode] = useState<IncomeTaxMode>(item?.taxMode ?? "NONE")
  const [notes, setNotes] = useState(item?.notes ?? "")
  const [reason, setReason] = useState("")
  const [lines, setLines] = useState<IncomeLineDraft[]>(() => (item ? itemToDrafts(item) : []))
  const [editing, setEditing] = useState<IncomeLineDraft | null>(null)
  const [pickerCategoryId, setPickerCategoryId] = useState<string | null>(null)
  const [pickerTypeId, setPickerTypeId] = useState("")
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([
      fetch("/api/finance/incomes/options", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/income-categories", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/income-types", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/master-data/units", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([o, cat, ty, u]) => {
        const branchRows = (o.data?.branches ?? []) as Option[]
        const typeRows = (ty.data ?? []) as IncomeTypeOption[]
        const categoryRows = (cat.data ?? []) as IncomeCategoryRow[]
        setBranches(branchRows)
        setEmployees((o.data?.employees ?? []) as Option[])
        setCategories(categoryRows)
        setTypes(typeRows)
        setPickerCategoryId((cur) => cur ?? defaultIncomeCategoryId(typeRows, categoryRows))
        setUnits((u.data ?? []) as UnitOption[])
        setBranchId((cur) => cur || branchRows[0]?.id || "")
      })
      .catch(() => setError(t("loadFailed")))
  }, [t])

  const totals = useMemo(() => {
    let amount = 0
    let tax = 0
    let discount = 0
    let net = 0
    for (const l of lines) {
      const m = incomeLineMoney(l, taxMode)
      amount += m.amount
      tax += m.tax
      discount += m.discount
      net += m.net
    }
    return { amount, tax, discount, net }
  }, [lines, taxMode])

  const typeName = (id: string) => types.find((x) => x.id === id)?.name ?? "—"
  const unitCode = (id: string) => units.find((x) => x.id === id)?.code ?? ""

  function saveLine(draft: IncomeLineDraft) {
    setLines((prev) => (prev.some((l) => l.key === draft.key) ? prev.map((l) => (l.key === draft.key ? draft : l)) : [...prev, draft]))
    setEditing(null)
  }

  function openLine(line: IncomeLineDraft) {
    setEditing(line)
  }

  function pickType(typeId: string) {
    if (received) return
    setPickerTypeId(typeId)
    setError(null)
    setEditing({ ...newIncomeLineDraft(), incomeTypeId: typeId })
  }

  function addLine() {
    if (!pickerTypeId) return setError(t("errPickType"))
    setError(null)
    setEditing({ ...newIncomeLineDraft(), incomeTypeId: pickerTypeId })
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((x) => x.key !== key))
  }

  function linePayload(l: IncomeLineDraft) {
    if (received) {
      return {
        id: l.id,
        incomeTypeId: l.incomeTypeId,
        description: l.description.trim() || null,
        costCenterId: l.costCenterId || null,
        processId: l.processId || null,
      }
    }
    const qty = l.pricingMode === "QTY_PRICE"
    return {
      ...(l.id ? { id: l.id } : {}),
      incomeTypeId: l.incomeTypeId,
      description: l.description.trim() || null,
      pricingMode: l.pricingMode,
      quantity: qty ? Number(l.quantity) || 0 : 1,
      unitId: qty ? l.unitId || null : null,
      unitPrice: qty ? Number(l.unitPrice) || 0 : 0,
      amount: incomeLineAmount(l),
      taxAmount: incomeLineMoney(l, taxMode).tax,
      discountAmount: Number(l.discountAmount) || 0,
      costCenterId: l.costCenterId || null,
      processId: l.processId || null,
    }
  }

  async function submit(status: "DRAFT" | "PENDING" | null) {
    if (!received) {
      if (!branchId) return setError(t("errBranch"))
      if (!payerName.trim()) return setError(t("errPayer"))
    }
    if (lines.length === 0) return setError(t("errLines"))
    if (received && !reason.trim()) return setError(t("errReason"))
    setError(null)
    setSaving(status ?? "save")
    const body = received
      ? { notes: notes.trim() || null, reason: reason.trim(), lines: lines.map(linePayload) }
      : {
          branchId,
          incomeDate,
          postingDate: postingDate || null,
          payerName: payerName.trim(),
          employeeId: employeeId || null,
          paymentMethod: paymentMethod || null,
          taxMode,
          notes: notes.trim() || null,
          ...(status ? { status } : {}),
          lines: lines.map(linePayload),
        }
    try {
      const res = await fetch(item ? `/api/finance/incomes/${item.id}` : "/api/finance/incomes", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(errorText(json, t("saveFailed")))
        return
      }
      const id = (json.data?.id as string | undefined) ?? item?.id
      router.push(id ? `/finance/incomes/${id}` : "/finance/incomes")
      router.refresh()
    } catch {
      setError(t("saveFailed"))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <PageHeader
        title={item ? t("editTitle", { no: item.incomeNo }) : t("newTitle")}
        description={received ? t("receivedEditHint") : undefined}
        actions={item ? <IncomePrintButtons id={item.id} /> : undefined}
      />

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <DataPanel padding="sm">
        <h2 className="sr-only">{t("docInfo")}</h2>
        <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <Select
            label={t("branch")}
            required
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={received}
            placeholder={t("selectBranch")}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <Input
            label={t("incomeDate")}
            type="date"
            required
            value={incomeDate}
            onChange={(e) => setIncomeDate(e.target.value)}
            disabled={received}
          />
          <Input
            label={t("postingDate")}
            type="date"
            value={postingDate}
            onChange={(e) => setPostingDate(e.target.value)}
            disabled={received}
          />
          <Input
            label={t("payerCustomer")}
            required
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            disabled={received}
            placeholder={t("payerPlaceholder")}
          />
          <Select
            label={t("employee")}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={received}
            options={[{ value: "", label: t("none") }, ...employees.map((x) => ({ value: x.id, label: x.name }))]}
          />
          <Input label={t("notes")} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {received && (
            <div className="sm:col-span-2 lg:col-span-3 2xl:col-span-6">
              <Input
                label={t("reason")}
                required
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
              />
            </div>
          )}
        </div>
      </DataPanel>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <DataPanel padding="md" className="min-w-0">
        <IncomeTypePicker
          types={types}
          categories={categories}
          categoryId={pickerCategoryId}
          typeId={pickerTypeId}
          disabled={received}
          onPickCategory={setPickerCategoryId}
          onPickType={pickType}
        />
      </DataPanel>

      <DataPanel padding="md" className="min-w-0 xl:sticky xl:top-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShoppingCart className="h-4 w-4" />
            {t("cartTitle")}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {t("cartCount", { count: lines.length })}
            </span>
          </h2>
          {!received && (
            <Button type="button" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addLine}>
              {t("addLine")}
            </Button>
          )}
        </div>

        {lines.length === 0 ? (
          <button
            type="button"
            disabled={received}
            onClick={addLine}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border py-10 text-sm text-foreground hover:bg-muted"
          >
            <Plus className="h-5 w-5" />
            {t("cartEmpty")}
            <span className="text-xs text-muted-foreground">{t("cartEmptyHint")}</span>
          </button>
        ) : (
          <div className="max-h-72 overflow-auto rounded-lg border border-border [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10">
            <AppDataTable>
              <AppDataTableHead sticky={false}>
                <tr>
                  <th className="w-8">#</th>
                  <th>{t("type")}</th>
                  <th className="text-right">{t("quantity")}</th>
                  <th className="text-right">{t("unitPrice")}</th>
                  <th className="hidden text-right lg:table-cell">{t("discount")}</th>
                  <th className="text-right">{t("netAmount")}</th>
                  <th className="w-16" />
                </tr>
              </AppDataTableHead>
              <AppDataTableBody>
                {lines.map((l, i) => {
                  const qty = l.pricingMode === "QTY_PRICE"
                  return (
                    <tr key={l.key} className="cursor-pointer" onClick={() => openLine(l)}>
                      <td className="px-3 py-2.5 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{typeName(l.incomeTypeId)}</div>
                        {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        {qty ? `${l.quantity} ${unitCode(l.unitId)}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        {formatBaht(qty ? Number(l.unitPrice) || 0 : incomeLineAmount(l))}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-right tabular-nums lg:table-cell">
                        {formatBaht(Number(l.discountAmount) || 0)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">
                        {formatBaht(incomeLineNet(l, taxMode))}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          aria-label={t("editLine")}
                          className="mr-1 inline-flex rounded p-1 text-foreground hover:bg-muted"
                          onClick={() => openLine(l)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!received && (
                          <button
                            type="button"
                            aria-label={t("removeLine")}
                            className="inline-flex rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                            onClick={() => removeLine(l.key)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </AppDataTableBody>
            </AppDataTable>
          </div>
        )}

        <div className="mt-3 grid items-end gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <span className="block text-sm font-medium text-foreground">{t("paymentMethod")}</span>
            <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={t("paymentMethod")}>
              {(
                [
                  { value: "cash", label: t("paymentMethods.cash"), icon: Banknote },
                  { value: "credit", label: t("paymentMethods.credit"), icon: CreditCard },
                ] as const
              ).map((option) => {
                const selected = paymentMethod === option.value
                const Icon = option.icon
                return (
                  <button
                    key={option.value || "none"}
                    type="button"
                    disabled={received}
                    aria-pressed={selected}
                    onClick={() => setPaymentMethod(option.value)}
                    className={
                      selected
                        ? "inline-flex min-h-9 items-center justify-center gap-1 rounded-lg bg-blue-600 px-1.5 py-1.5 text-xs font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                        : "inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-border bg-background px-1.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    }
                  >
                    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="min-w-0">
            <Select
              label={t("taxMode")}
              required
              value={taxMode}
              onChange={(e) => setTaxMode(e.target.value as IncomeTaxMode)}
              disabled={received}
              className="py-1.5"
              options={INCOME_TAX_MODES.map((m) => ({ value: m, label: t(`taxModes.${m}`) }))}
            />
          </div>
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-foreground">
          <div className="flex justify-between">
            <span>{t("totalAmount")}</span>
            <span className="tabular-nums">{formatBaht(totals.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("discount")}</span>
            <span className="tabular-nums">{formatBaht(totals.discount)}</span>
          </div>
          {taxMode === "VAT_INCLUSIVE" && (
            <div className="flex justify-between">
              <span>{t("beforeVat")}</span>
              <span className="tabular-nums">{formatBaht(totals.net - totals.tax)}</span>
            </div>
          )}
          {(taxMode !== "NONE" || totals.tax > 0) && (
            <div className="flex justify-between">
              <span>{t("vatLabel")}</span>
              <span className="tabular-nums">{formatBaht(totals.tax)}</span>
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg bg-emerald-500/15 px-3 py-2">
            <span className="font-medium">{t("netAmount")}</span>
            <span className="text-lg font-bold tabular-nums">{formatBaht(totals.net)}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {received ? (
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              loading={saving === "save"}
              onClick={() => void submit(null)}
            >
              {t("save")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" loading={saving === "DRAFT"} onClick={() => void submit("DRAFT")}>
                {t("saveDraft")}
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700"
                loading={saving === "PENDING"}
                onClick={() => void submit("PENDING")}
              >
                {t("submitApproval")}
              </Button>
            </>
          )}
        </div>
      </DataPanel>
      </div>

      {editing && (
        <IncomeLineDialog
          key={editing.key}
          open
          initial={editing}
          typeName={typeName(editing.incomeTypeId)}
          types={types}
          categories={categories}
          units={units}
          taxMode={taxMode}
          lockFinancials={received}
          onClose={() => setEditing(null)}
          onSave={saveLine}
        />
      )}
    </div>
  )
}
