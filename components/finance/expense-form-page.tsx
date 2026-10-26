"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Banknote, Camera, CreditCard, Paperclip, Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { GlassDialog } from "@/components/glass"
import { PageHeader } from "@/components/shell/page-header"
import { DataPanel } from "@/components/shell/data-panel"
import { AppDataTable, AppDataTableBody, AppDataTableHead } from "@/components/shell/app-data-table"
import { cn } from "@/lib/utils"
import type {
  AssetOption,
  CostCenterRow,
  ExpenseAttachmentDto,
  ExpenseDto,
  ExpenseTypeOption,
  FinancePerms,
  LineDraft,
  Option,
  UnitOption,
} from "./expense-types"
import {
  ExpenseLineDialog,
  computeDiscountBaht,
  computeLineAmount,
  computeLineNet,
  computeLineTax,
  newLineDraft,
} from "./expense-line-dialog"
import {
  anyLineRequiresVendor,
  applyTypeChange,
  prefillSourceCostCenter,
  transportCostCenterId,
  validateExpenseForm,
} from "./expense-form-validation"
import { ExpenseTypePicker, defaultExpenseCategoryKey } from "./expense-type-picker"
import { formatBaht, solidBlueButtonClass, sourceModuleLabel } from "./finance-theme"
import { IncomeFileThumbs } from "./income-file-thumbs"

const addLineButtonClass =
  "relative z-10 flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-blue-300 bg-blue-100 py-10 text-sm font-medium text-blue-900 hover:border-blue-400 hover:bg-blue-200 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-100 dark:hover:bg-blue-500/30"

type PendingImage = { key: string; file: File; url: string }

function errorText(json: { error?: unknown }, fallback: string): string {
  if (typeof json.error === "string" && json.error.trim()) return json.error
  if (json.error && typeof json.error === "object" && "message" in json.error) {
    const m = (json.error as { message?: unknown }).message
    if (typeof m === "string" && m.trim()) return m
  }
  return fallback
}

export const NEW_EXPENSE_SOURCES_KEY = "finance:new-expense-sources"

export function clearNewExpenseSourcePrefill() {
  try {
    sessionStorage.removeItem(NEW_EXPENSE_SOURCES_KEY)
  } catch {
    // ignore unavailable storage
  }
}

export type PrefillPayload = {
  branchId?: string
  expenseDate?: string
  paymentMethod?: "cash" | "credit" | null
  lines: LineDraft[]
}

function todayYmdBangkok() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
}

function itemToDrafts(item: ExpenseDto): LineDraft[] {
  return item.lines.map((l) => ({
    key: l.id,
    expenseTypeId: l.expenseTypeId,
    description: l.description ?? "",
    pricingMode: l.pricingMode,
    quantity: String(l.quantity),
    unitId: l.unitId ?? "",
    unitCode: l.unitCode ?? "",
    unitPrice: String(l.unitPrice),
    amount: String(l.amount),
    taxAmount: l.taxAmount ? String(l.taxAmount) : "",
    taxMode: l.taxMode ?? "NONE",
    discountAmount: l.discountAmount ? String(l.discountAmount) : "",
    discountKind: "BAHT" as const,
    costCenterId: l.costCenterId ?? "",
    costObjectType: l.costObjectType ?? "",
    costObjectId: l.costObjectId ?? "",
    costObjectLabel: l.costObjectLabel ?? "",
    sourceKind: l.sourceKind,
    sourceModule: l.sourceModule,
    sourceType: l.sourceType,
    sourceDocumentId: l.sourceDocumentId,
    sourceLineId: l.sourceLineId,
    sourceAmountLocked: l.sourceKind !== "MANUAL" && l.sourceType !== "TRANSPORT_JOB",
  }))
}

export function ExpenseFormPage({
  mode,
  item,
  ignoreSourcePrefill = false,
  perms,
}: {
  mode: "create" | "edit"
  item?: ExpenseDto
  ignoreSourcePrefill?: boolean
  perms: FinancePerms
}) {
  const router = useRouter()
  const tFiles = useTranslations("expenseFiles")

  const [branches, setBranches] = useState<Option[]>([])
  const [types, setTypes] = useState<ExpenseTypeOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const [vendors, setVendors] = useState<Option[]>([])
  const [employees, setEmployees] = useState<Option[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [assets, setAssets] = useState<AssetOption[]>([])

  const [branchId, setBranchId] = useState(item?.branchId ?? "")
  const [expenseDate, setExpenseDate] = useState(item?.expenseDate ?? todayYmdBangkok())
  const [postingDate, setPostingDate] = useState(item?.postingDate ?? item?.expenseDate ?? todayYmdBangkok())
  const [vendorId, setVendorId] = useState(item?.vendorId ?? "")
  const [employeeId, setEmployeeId] = useState(item?.employeeId ?? "")
  const [paymentMethod, setPaymentMethod] = useState<string>(item?.paymentMethod ?? "")
  const [notes, setNotes] = useState(item?.notes ?? "")
  const [reason, setReason] = useState("")
  const status = item?.status === "PENDING" ? "PENDING" : "DRAFT"

  const [lines, setLines] = useState<LineDraft[]>(item ? itemToDrafts(item) : [])
  const [editingLine, setEditingLine] = useState<LineDraft | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerCategoryKey, setPickerCategoryKey] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | undefined>(item?.id)
  const [images, setImages] = useState<PendingImage[]>([])
  const savedImages: ExpenseAttachmentDto[] = item?.attachments ?? []

  // Load option lists; seed branch/lines from a "create from sources" hand-off.
  useEffect(() => {
    void Promise.all([
      fetch("/api/finance/branches", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/expense-types", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/cost-centers", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/vendors", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/employees", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/master-data/units", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/assets", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([b, t, c, v, e, u, a]) => {
        const branchRows = (b.data ?? []) as Option[]
        setBranches(branchRows)
        const typeRows = (t.data ?? []) as ExpenseTypeOption[]
        setTypes(typeRows)
        setPickerCategoryKey((cur) => cur ?? defaultExpenseCategoryKey(typeRows, ""))
        const costCenterRows = (c.data ?? []) as CostCenterRow[]
        setCostCenters(costCenterRows)
        const transportCcId = transportCostCenterId(costCenterRows)
        setVendors((v.data ?? []) as Option[])
        setEmployees((e.data ?? []) as Option[])
        const unitRows = (u.data ?? []) as UnitOption[]
        setUnits(unitRows)
        setAssets((a.data ?? []) as AssetOption[])
        setLines((prev) =>
          prev.map((l) => {
            if (l.unitId || !l.unitCode) return l
            const match = unitRows.find((row) => row.code === l.unitCode)
            return match ? { ...l, unitId: match.id } : l
          })
        )

        if (mode === "create") {
          let seeded = false
          if (ignoreSourcePrefill) {
            clearNewExpenseSourcePrefill()
          } else {
            try {
              const raw = sessionStorage.getItem(NEW_EXPENSE_SOURCES_KEY)
              if (raw) {
                const payload = JSON.parse(raw) as PrefillPayload
                if (payload.lines?.length) {
                  setLines(payload.lines.map((l) => prefillSourceCostCenter(l, transportCcId)))
                  if (payload.branchId) setBranchId(payload.branchId)
                  if (payload.expenseDate) setExpenseDate(payload.expenseDate)
                  if (payload.paymentMethod) setPaymentMethod(payload.paymentMethod)
                  seeded = true
                }
              }
            } catch {
              // ignore malformed hand-off
            }
          }
          if (!seeded && !branchId && branchRows[0]) setBranchId(branchRows[0].id)
          if (!seeded) setPickerOpen(true)
        }
      })
      .catch(() => {
        setError("โหลดข้อมูลตัวเลือกไม่สำเร็จ กรุณารีเฟรชหน้า")
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const typeName = useMemo(() => {
    const map = new Map(types.map((t) => [t.id, t.name]))
    return (id: string) => map.get(id) ?? "—"
  }, [types])

  const unitName = useMemo(() => {
    const byId = new Map(units.map((u) => [u.id, u.name]))
    const byCode = new Map(units.map((u) => [u.code, u.name]))
    return (line: LineDraft) => {
      if (line.unitId && byId.has(line.unitId)) return byId.get(line.unitId) as string
      if (line.unitCode) return byCode.get(line.unitCode) ?? line.unitCode
      return "—"
    }
  }, [units])

  const vendorRequired = useMemo(() => anyLineRequiresVendor(lines, types), [lines, types])
  const lockFinancials = item?.status === "PAID"

  const totals = useMemo(() => {
    let amount = 0
    let tax = 0
    let discount = 0
    let net = 0
    for (const l of lines) {
      amount += computeLineAmount(l)
      tax += computeLineTax(l, lockFinancials)
      discount += computeDiscountBaht(l)
      net += computeLineNet(l, lockFinancials)
    }
    return {
      amount: Math.round(amount * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      net: Math.round(net * 100) / 100,
    }
  }, [lines, lockFinancials])

  // Group by source module for display (manual = null bucket).
  const groups = useMemo(() => {
    const map = new Map<string, LineDraft[]>()
    for (const l of lines) {
      const key = l.sourceModule ?? "__manual__"
      const arr = map.get(key) ?? []
      arr.push(l)
      map.set(key, arr)
    }
    return [...map.entries()]
  }, [lines])

  function openAddLine() {
    if (lockFinancials) return
    setError(null)
    setPickerOpen(true)
  }

  function pickType(typeId: string) {
    setPickerOpen(false)
    setEditingLine(applyTypeChange(newLineDraft(), types.find((t) => t.id === typeId)))
    setDialogOpen(true)
  }

  function addImages(list: FileList | null) {
    if (!list || list.length === 0) return
    const next = [...list]
      .filter((file) => file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name))
      .map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file),
      }))
    if (next.length === 0) {
      setError("แนบได้เฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)")
      return
    }
    setError(null)
    setImages((prev) => [...prev, ...next])
  }

  function removeImage(key: string) {
    setImages((prev) => {
      const found = prev.find((image) => image.key === key)
      if (found) URL.revokeObjectURL(found.url)
      return prev.filter((image) => image.key !== key)
    })
  }

  async function uploadImages(expenseId: string) {
    for (const image of images) {
      const form = new FormData()
      form.append("file", image.file)
      const res = await fetch(`/api/finance/expenses/${expenseId}/files`, { method: "POST", body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errorText(json, tFiles("uploadFailed")))
      URL.revokeObjectURL(image.url)
      setImages((prev) => prev.filter((row) => row.key !== image.key))
    }
  }

  function openEditLine(line: LineDraft) {
    setEditingLine(line)
    setDialogOpen(true)
  }

  function saveLine(draft: LineDraft) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.key === draft.key)
      if (idx === -1) {
        if (lockFinancials) return prev
        return [...prev, draft]
      }
      const next = [...prev]
      next[idx] = draft
      return next
    })
    setDialogOpen(false)
    setEditingLine(null)
  }

  function removeLine(key: string) {
    if (lockFinancials) return
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  async function submit(nextStatus?: string) {
    const formError = validateExpenseForm({ branchId, vendorId, lines, types })
    if (formError) {
      setError(formError)
      return
    }
    if (lockFinancials && !reason.trim()) {
      setError("กรุณาระบุเหตุผลในการแก้ไขบิลที่จ่ายแล้ว")
      return
    }
    setSaving(nextStatus ?? "save")
    setError(null)
    try {
      const payload = {
        branchId,
        expenseDate,
        ...(lockFinancials
          ? {}
          : {
              postingDate,
              paymentMethod: paymentMethod || null,
              status: nextStatus ?? status,
            }),
        vendorId: vendorId || null,
        employeeId: employeeId || null,
        notes: notes || null,
        ...(lockFinancials ? { reason: reason.trim() } : {}),
        lines: lines.map((l) => {
          const saved = item?.lines.find((row) => row.id === l.key)
          const paid = lockFinancials ? saved : undefined
          return {
          ...(lockFinancials && /^[0-9a-f-]{36}$/i.test(l.key) ? { id: l.key } : {}),
          expenseTypeId: l.expenseTypeId,
          description: l.description || null,
          pricingMode: paid ? paid.pricingMode : l.pricingMode,
          quantity: paid ? paid.quantity : Number(l.quantity) || (l.pricingMode === "AMOUNT" ? 1 : 0),
          unitId: l.unitId || null,
          unitCode: l.unitCode || null,
          unitPrice: paid ? paid.unitPrice : Number(l.unitPrice) || 0,
          amount: paid ? paid.amount : computeLineAmount(l),
          ...(paid ? { taxAmount: paid.taxAmount } : {}),
          taxMode: paid ? paid.taxMode : l.taxMode,
          discountAmount: paid ? paid.discountAmount : computeDiscountBaht(l),
          costCenterId: l.costCenterId || null,
          costObjectType: lockFinancials ? (saved?.costObjectType ?? null) : l.costObjectType || null,
          costObjectId: lockFinancials ? (saved?.costObjectId ?? null) : l.costObjectId || null,
          costObjectLabel: lockFinancials ? (saved?.costObjectLabel ?? null) : l.costObjectLabel || null,
          sourceKind: saved?.sourceKind ?? l.sourceKind,
          sourceModule: saved?.sourceModule ?? l.sourceModule,
          sourceType: saved?.sourceType ?? l.sourceType,
          sourceDocumentId: saved?.sourceDocumentId ?? l.sourceDocumentId,
          sourceLineId: saved?.sourceLineId ?? l.sourceLineId,
        }
        }),
      }

      const targetId = savedId
      const url = targetId ? `/api/finance/expenses/${targetId}` : "/api/finance/expenses"
      const res = await fetch(url, {
        method: targetId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : json.error?.message ?? "บันทึกไม่สำเร็จ")
        return
      }
      if (mode === "create") clearNewExpenseSourcePrefill()
      const id = (json.data?.id as string | undefined) ?? targetId
      if (!id) {
        router.push("/finance/expenses")
        router.refresh()
        return
      }
      setSavedId(id)
      try {
        await uploadImages(id)
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : tFiles("uploadFailed"))
        return
      }
      router.push(`/finance/expenses/${id}`)
      router.refresh()
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง")
    } finally {
      setSaving(null)
    }
  }

  const paymentOptions = [
    { value: "cash", label: "เงินสด", icon: Banknote },
    { value: "credit", label: "เครดิต", icon: CreditCard },
  ] as const

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <PageHeader
        title={
          lockFinancials
            ? `แก้ข้อมูล ${item?.expenseNo ?? ""}`
            : mode === "edit"
              ? `แก้ไข ${item?.expenseNo ?? ""}`
              : "สร้างบิลค่าใช้จ่ายใหม่"
        }
        description={
          lockFinancials
            ? "บิลจ่ายแล้ว — แก้ได้เฉพาะหมวดและอ้างอิง ยอดเงิน จำนวน ราคา ภาษี ส่วนลด และต้นทางถูกล็อก"
            : mode === "create"
              ? "บันทึกจาก Finance ได้โดยตรง ไม่ต้องมีเอกสารจากโมดูลอื่น"
              : undefined
        }
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <DataPanel padding="md">
        <h2 className="mb-3 text-sm font-semibold text-foreground">ข้อมูลเอกสาร</h2>
        <div className="space-y-3">
          <Select
            label="สาขา"
            required
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={lockFinancials}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <Input label="วันที่เกิดรายการ" type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          <Input
            label="วันที่ลงบัญชี"
            type="date"
            value={postingDate}
            onChange={(e) => setPostingDate(e.target.value)}
            disabled={lockFinancials}
          />
          <Select
            label="ผู้ขาย / ผู้รับเงิน"
            required={vendorRequired}
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            options={[{ value: "", label: vendorRequired ? "— เลือกผู้ขาย —" : "— ไม่ระบุ —" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
          />
          <Select
            label="พนักงานที่เกี่ยวข้อง"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            options={[{ value: "", label: "— ไม่ระบุ —" }, ...employees.map((emp) => ({ value: emp.id, label: emp.name }))]}
          />
          <Input label="หมายเหตุ" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {lockFinancials && (
            <Input
              label="เหตุผลในการแก้ไข"
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น แก้หมวดค่าใช้จ่ายให้ถูกต้อง"
            />
          )}
        </div>
      </DataPanel>

      <DataPanel padding="md" className="min-w-0 lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShoppingCart className="h-4 w-4" />
            รายการค่าใช้จ่าย
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {lines.length} รายการ
            </span>
          </h2>
        </div>

        {lines.length === 0 ? (
          <button type="button" disabled={lockFinancials} onClick={openAddLine} className={addLineButtonClass}>
            <Plus className="h-5 w-5" />
            ยังไม่มีรายการ
            <span className="text-xs font-normal text-blue-700 dark:text-blue-200">กดเพื่อเลือกหมวดและประเภทค่าใช้จ่าย</span>
          </button>
        ) : (
          <div className="max-h-72 overflow-auto rounded-lg border border-border [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10">
            <AppDataTable>
              <AppDataTableHead sticky={false}>
                <tr>
                  <th>ประเภท / รายละเอียด</th>
                  <th className="text-right">จำนวน</th>
                  <th>หน่วย</th>
                  <th className="text-right">ราคา/หน่วย</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th className="text-right">สุทธิ</th>
                  <th className="text-right">จัดการ</th>
                </tr>
              </AppDataTableHead>
              <AppDataTableBody>
                {groups.map(([groupKey, groupLines]) => (
                  <Fragment key={`grp-${groupKey}`}>
                    <tr data-tone="group" className="bg-slate-100/50 dark:bg-white/5">
                      <td colSpan={7} className="px-4 py-1.5 text-xs font-semibold">
                        {groupKey === "__manual__" ? "บันทึกเอง" : sourceModuleLabel(groupKey)}
                      </td>
                    </tr>
                    {groupLines.map((l) => (
                      <tr key={l.key}>
                        <td className="px-4 py-2">
                          <div className="font-medium text-foreground">{typeName(l.expenseTypeId)}</div>
                          {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
                          {l.sourceAmountLocked && (
                            <span className="mt-0.5 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
                              ยอดอ้างอิง
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{l.pricingMode === "QTY_PRICE" ? l.quantity : "—"}</td>
                        <td className="px-4 py-2">{unitName(l)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{l.pricingMode === "QTY_PRICE" ? formatBaht(Number(l.unitPrice) || 0) : "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatBaht(computeLineAmount(l))}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatBaht(computeLineNet(l, lockFinancials))}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <button type="button" className="rounded p-1 text-muted-foreground hover:bg-slate-200/60 hover:text-foreground dark:hover:bg-white/10" onClick={() => openEditLine(l)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {!lockFinancials && (
                              <button type="button" className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => removeLine(l.key)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </AppDataTableBody>
            </AppDataTable>
          </div>
        )}

        {!lockFinancials && lines.length > 0 && (
          <button type="button" onClick={openAddLine} className={cn("mt-3", addLineButtonClass)}>
            <Plus className="h-5 w-5" />
            เพิ่มรายการ
            <span className="text-xs font-normal text-blue-700 dark:text-blue-200">กดเพื่อเลือกหมวดและประเภทค่าใช้จ่าย</span>
          </button>
        )}

        <div className="mt-3 grid items-stretch gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            {perms.canUpdate && (
              <>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{tFiles("title")}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={cn(solidBlueButtonClass, "inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium")}>
                      <Camera className="h-3.5 w-3.5" />
                      {tFiles("takePhoto")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="sr-only"
                        onChange={(e) => {
                          addImages(e.target.files)
                          e.target.value = ""
                        }}
                      />
                    </label>
                    <label className={cn(solidBlueButtonClass, "inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium")}>
                      <Paperclip className="h-3.5 w-3.5" />
                      {tFiles("attach")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        multiple
                        className="sr-only"
                        onChange={(e) => {
                          addImages(e.target.files)
                          e.target.value = ""
                        }}
                      />
                    </label>
                  </div>
                </div>
                {images.length === 0 && savedImages.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Paperclip className="h-4 w-4" />
                    {tFiles("empty")}
                  </p>
                ) : (
                  <IncomeFileThumbs
                    removeLabel={tFiles("remove")}
                    onRemove={removeImage}
                    items={[
                      ...savedImages.map((file) => {
                        const name = file.fileName ?? tFiles("unnamed")
                        return {
                          key: file.id,
                          name,
                          href: file.fileUrl,
                          preview: !name.toLowerCase().endsWith(".pdf"),
                          removable: false,
                        }
                      }),
                      ...images.map((image) => ({
                        key: image.key,
                        name: image.file.name,
                        href: image.url,
                        preview: true,
                        removable: true,
                      })),
                    ]}
                  />
                )}
              </>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-foreground">วิธีจ่าย</span>
              <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="วิธีจ่าย">
                {paymentOptions.map((option) => {
                  const selected = paymentMethod === option.value
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={lockFinancials}
                      aria-pressed={selected}
                      onClick={() => setPaymentMethod(selected ? "" : option.value)}
                      className={
                        selected
                          ? "relative z-10 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-3 py-3 text-base font-semibold text-white hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                          : "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:bg-slate-900 dark:text-white"
                      }
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-foreground">
              <div className="flex justify-between">
                <span>จำนวนเงิน</span>
                <span className="tabular-nums">{formatBaht(totals.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>ส่วนลด</span>
                <span className="tabular-nums">{formatBaht(totals.discount)}</span>
              </div>
              <div className="flex justify-between">
                <span>ภาษี</span>
                <span className="tabular-nums">{formatBaht(totals.tax)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/15 px-3 py-2">
                <span className="font-medium">สุทธิ</span>
                <span className="text-lg font-bold tabular-nums">{formatBaht(totals.net)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          {lockFinancials ? (
            <Button
              type="button"
              size="lg"
              className="h-16 w-56 bg-[#2563eb] text-lg font-semibold text-white hover:bg-[#1d4ed8]"
              loading={saving === "save"}
              onClick={() => void submit()}
            >
              บันทึก
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="lg"
                className="h-16 w-56 border border-slate-300 bg-[#e2e8f0] text-lg font-semibold text-[#0f172a] hover:bg-[#cbd5e1]"
                loading={saving === "DRAFT"}
                disabled={saving !== null}
                onClick={() => void submit("DRAFT")}
              >
                บันทึกร่าง
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-16 w-56 bg-[#2563eb] text-lg font-semibold text-white hover:bg-[#1d4ed8]"
                loading={saving === "PENDING"}
                disabled={saving !== null}
                onClick={() => void submit("PENDING")}
              >
                ส่งอนุมัติ
              </Button>
            </>
          )}
        </div>
      </DataPanel>
      </div>

      <GlassDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="เลือกหมวดและประเภทค่าใช้จ่าย"
        className="max-w-6xl"
        solid
      >
        <ExpenseTypePicker
          types={types}
          categoryKey={pickerCategoryKey}
          typeId=""
          onPickCategory={setPickerCategoryKey}
          onPickType={pickType}
        />
      </GlassDialog>

      {editingLine && (
        <ExpenseLineDialog
          key={editingLine.key}
          open={dialogOpen}
          initial={editingLine}
          types={types}
          costCenters={costCenters}
          units={units}
          assets={assets}
          lockFinancials={lockFinancials}
          onClose={() => {
            setDialogOpen(false)
            setEditingLine(null)
          }}
          onSave={saveLine}
        />
      )}
    </div>
  )
}
