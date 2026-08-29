"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  GlassDialog,
  GlassForm,
  GlassFormActions,
  GlassInput,
  GlassTable,
  GlassTableBody,
  GlassTableCell,
  GlassTableHead,
  GlassTableHeader,
  GlassTableRow,
} from "@/components/glass"
import { FinancePageHeader } from "./finance-page-header"
import { FIN_GLASS_PANEL } from "./finance-theme"
import type {
  CostCenterRow,
  ExpenseCategoryRow,
  ExpenseTypeMapRow,
  ExpenseTypeOption,
  FinancePerms,
  ProcessRow,
} from "./expense-types"

const TX_TYPES = ["EXPENSE", "COST", "INCOME", "ASSET", "LIABILITY"]
const TX_TYPE_LABELS: Record<string, string> = {
  EXPENSE: "ค่าใช้จ่าย",
  COST: "ต้นทุน",
  INCOME: "รายได้",
  ASSET: "สินทรัพย์",
  LIABILITY: "หนี้สิน",
}

const COST_TYPE_LABELS: Record<string, string> = {
  FIXED: "คงที่",
  VARIABLE: "ผันแปร",
  MIXED: "ผสม",
}
const DIRECTNESS_LABELS: Record<string, string> = {
  DIRECT: "ทางตรง",
  INDIRECT: "ทางอ้อม",
}

const REQUIRED_DIMENSIONS: { key: RequiredDimensionKey; label: string }[] = [
  { key: "requiresVendor", label: "ผู้ขาย" },
  { key: "requiresVehicle", label: "ยานพาหนะ" },
  { key: "requiresMachine", label: "เครื่องจักร" },
  { key: "requiresLocation", label: "สถานที่" },
  { key: "requiresCostCenter", label: "หน่วยงาน" },
  { key: "requiresProcess", label: "กระบวนการ" },
]

type RequiredDimensionKey =
  | "requiresVendor"
  | "requiresVehicle"
  | "requiresMachine"
  | "requiresLocation"
  | "requiresCostCenter"
  | "requiresProcess"

type Tab = "types" | "categories" | "processes" | "cost_centers"

const TABS: { key: Tab; label: string }[] = [
  { key: "types", label: "ประเภทค่าใช้จ่าย" },
  { key: "categories", label: "หมวดค่าใช้จ่าย" },
  { key: "processes", label: "กระบวนการ" },
  { key: "cost_centers", label: "หน่วยงาน (Cost Center)" },
]

export function FinanceMasterData({ perms }: { perms: FinancePerms }) {
  const [tab, setTab] = useState<Tab>("types")
  const [types, setTypes] = useState<ExpenseTypeOption[]>([])
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([])
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [centers, setCenters] = useState<CostCenterRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const [typeDialog, setTypeDialog] = useState<{ open: boolean; row?: ExpenseTypeOption }>({ open: false })
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; row?: ExpenseCategoryRow }>({ open: false })
  const [processDialog, setProcessDialog] = useState<{ open: boolean; row?: ProcessRow }>({ open: false })
  const [centerDialog, setCenterDialog] = useState<{ open: boolean; row?: CostCenterRow }>({ open: false })

  const load = useCallback(async () => {
    const [t, cat, p, c] = await Promise.all([
      fetch("/api/finance/expense-types?includeInactive=1").then((r) => r.json()),
      fetch("/api/finance/expense-categories?includeInactive=1").then((r) => r.json()),
      fetch("/api/finance/processes?includeInactive=1").then((r) => r.json()),
      fetch("/api/finance/cost-centers?includeInactive=1").then((r) => r.json()),
    ])
    setTypes((t.data ?? []) as ExpenseTypeOption[])
    setCategories((cat.data ?? []) as ExpenseCategoryRow[])
    setProcesses((p.data ?? []) as ProcessRow[])
    setCenters((c.data ?? []) as CostCenterRow[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(kind: Tab, id: string) {
    setError(null)
    const url =
      kind === "types"
        ? `/api/finance/expense-types/${id}`
        : kind === "categories"
          ? `/api/finance/expense-categories/${id}`
          : kind === "processes"
            ? `/api/finance/processes/${id}`
            : `/api/finance/cost-centers/${id}`
    const res = await fetch(url, { method: "DELETE" })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(typeof json.error === "string" ? json.error : json.error?.message ?? "ลบไม่สำเร็จ")
      return
    }
    void load()
  }

  function openCreate() {
    if (tab === "types") setTypeDialog({ open: true })
    else if (tab === "categories") setCategoryDialog({ open: true })
    else if (tab === "processes") setProcessDialog({ open: true })
    else setCenterDialog({ open: true })
  }

  const activeCategories = categories.filter((c) => c.isActive)
  const activeCenters = centers.filter((c) => c.isActive)
  const activeProcesses = processes.filter((p) => p.isActive)

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="ข้อมูลพื้นฐานการเงิน"
        description="จัดการประเภทค่าใช้จ่าย หมวด กระบวนการ และหน่วยงาน (Cost Center)"
        actions={
          perms.canManageMasters ? (
            <Button
              type="button"
              icon={<Plus className="h-4 w-4" />}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
              onClick={openCreate}
            >
              เพิ่ม
            </Button>
          ) : undefined
        }
      />

      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200/70 bg-white/50 p-1 dark:border-white/10 dark:bg-white/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition",
              tab === t.key ? "bg-emerald-600 text-white shadow" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === "types" && (
        <GlassTable className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
          <GlassTableHeader className="border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/5">
            <tr>
              <GlassTableHead>รหัส</GlassTableHead>
              <GlassTableHead>ชื่อ</GlassTableHead>
              <GlassTableHead>หมวด</GlassTableHead>
              <GlassTableHead>หมวดย่อย</GlassTableHead>
              <GlassTableHead>ลักษณะต้นทุน</GlassTableHead>
              <GlassTableHead>ทางตรง/อ้อม</GlassTableHead>
              <GlassTableHead>GL (ชั่วคราว)</GlassTableHead>
              <GlassTableHead>สถานะ</GlassTableHead>
              <GlassTableHead className="text-right">การกระทำ</GlassTableHead>
            </tr>
          </GlassTableHeader>
          <GlassTableBody>
            {types.map((row) => (
              <GlassTableRow key={row.id} className="bg-white/50 dark:bg-transparent">
                <GlassTableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {row.code ?? "—"}
                </GlassTableCell>
                <GlassTableCell className="font-medium text-foreground">{row.name}</GlassTableCell>
                <GlassTableCell className="text-muted-foreground">{row.categoryName ?? "—"}</GlassTableCell>
                <GlassTableCell className="text-muted-foreground">{row.subcategory ?? "—"}</GlassTableCell>
                <GlassTableCell className="text-muted-foreground">
                  {row.defaultCostType ? COST_TYPE_LABELS[row.defaultCostType] : "—"}
                </GlassTableCell>
                <GlassTableCell className="text-muted-foreground">
                  {row.defaultDirectness ? DIRECTNESS_LABELS[row.defaultDirectness] : "—"}
                </GlassTableCell>
                <GlassTableCell className="text-muted-foreground">{row.defaultGlLabel ?? "—"}</GlassTableCell>
                <GlassTableCell>
                  <span className={cn("text-xs", row.isActive ? "text-emerald-600" : "text-muted-foreground")}>
                    {row.isActive ? "ใช้งาน" : "ปิด"}
                  </span>
                </GlassTableCell>
                <GlassTableCell className="whitespace-nowrap text-right">
                  {perms.canManageMasters && (
                    <div className="inline-flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        onClick={() => setTypeDialog({ open: true, row })}
                      >
                        แก้ไข
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => remove("types", row.id)}
                      >
                        ลบ
                      </Button>
                    </div>
                  )}
                </GlassTableCell>
              </GlassTableRow>
            ))}
          </GlassTableBody>
        </GlassTable>
      )}

      {tab === "categories" && (
        <SimpleMasterTable
          rows={categories}
          extraHead="หมวดแม่"
          extraCell={(r) => r.parentName ?? "—"}
          canManage={perms.canManageMasters}
          onEdit={(row) => setCategoryDialog({ open: true, row })}
          onRemove={(id) => remove("categories", id)}
        />
      )}

      {tab === "processes" && (
        <SimpleMasterTable
          rows={processes}
          extraHead="กระบวนการแม่"
          extraCell={(r) => r.parentName ?? "—"}
          canManage={perms.canManageMasters}
          onEdit={(row) => setProcessDialog({ open: true, row })}
          onRemove={(id) => remove("processes", id)}
        />
      )}

      {tab === "cost_centers" && (
        <GlassTable className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
          <GlassTableHeader className="border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/5">
            <tr>
              <GlassTableHead className="w-[16%]">รหัส</GlassTableHead>
              <GlassTableHead className="w-[34%]">ชื่อ</GlassTableHead>
              <GlassTableHead className="w-[20%]">สาขา</GlassTableHead>
              <GlassTableHead className="w-[12%]">สถานะ</GlassTableHead>
              <GlassTableHead className="w-[18%] text-right">การกระทำ</GlassTableHead>
            </tr>
          </GlassTableHeader>
          <GlassTableBody>
            {centers.map((row) => (
              <GlassTableRow key={row.id} className="bg-white/50 dark:bg-transparent">
                <GlassTableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {row.code ?? "—"}
                </GlassTableCell>
                <GlassTableCell className="font-medium text-foreground">{row.name}</GlassTableCell>
                <GlassTableCell className="text-muted-foreground">{row.branchName ?? "ทุกสาขา"}</GlassTableCell>
                <GlassTableCell>
                  <span className={cn("text-xs", row.isActive ? "text-emerald-600" : "text-muted-foreground")}>
                    {row.isActive ? "ใช้งาน" : "ปิด"}
                  </span>
                </GlassTableCell>
                <GlassTableCell className="whitespace-nowrap text-right">
                  {perms.canManageMasters && (
                    <div className="inline-flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        onClick={() => setCenterDialog({ open: true, row })}
                      >
                        แก้ไข
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => remove("cost_centers", row.id)}
                      >
                        ลบ
                      </Button>
                    </div>
                  )}
                </GlassTableCell>
              </GlassTableRow>
            ))}
          </GlassTableBody>
        </GlassTable>
      )}

      <ExpenseTypeDialog
        state={typeDialog}
        categories={activeCategories}
        centers={activeCenters}
        processes={activeProcesses}
        onOpenChange={(open) => setTypeDialog((s) => ({ ...s, open }))}
        onSaved={() => {
          setTypeDialog({ open: false })
          void load()
        }}
      />
      <CategoryDialog
        state={categoryDialog}
        categories={categories}
        onOpenChange={(open) => setCategoryDialog((s) => ({ ...s, open }))}
        onSaved={() => {
          setCategoryDialog({ open: false })
          void load()
        }}
      />
      <ProcessDialog
        state={processDialog}
        processes={processes}
        onOpenChange={(open) => setProcessDialog((s) => ({ ...s, open }))}
        onSaved={() => {
          setProcessDialog({ open: false })
          void load()
        }}
      />
      <CostCenterDialog
        state={centerDialog}
        onOpenChange={(open) => setCenterDialog((s) => ({ ...s, open }))}
        onSaved={() => {
          setCenterDialog({ open: false })
          void load()
        }}
      />
    </div>
  )
}

/** Generic table for the simple {code,name,parentName,isActive} masters (categories, processes). */
function SimpleMasterTable<T extends { id: string; code: string | null; name: string; isActive: boolean }>({
  rows,
  extraHead,
  extraCell,
  canManage,
  onEdit,
  onRemove,
}: {
  rows: T[]
  extraHead: string
  extraCell: (row: T) => string
  canManage: boolean
  onEdit: (row: T) => void
  onRemove: (id: string) => void
}) {
  return (
    <GlassTable className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
      <GlassTableHeader className="border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/5">
        <tr>
          <GlassTableHead className="w-[18%]">รหัส</GlassTableHead>
          <GlassTableHead className="w-[36%]">ชื่อ</GlassTableHead>
          <GlassTableHead className="w-[22%]">{extraHead}</GlassTableHead>
          <GlassTableHead className="w-[10%]">สถานะ</GlassTableHead>
          <GlassTableHead className="w-[14%] text-right">การกระทำ</GlassTableHead>
        </tr>
      </GlassTableHeader>
      <GlassTableBody>
        {rows.map((row) => (
          <GlassTableRow key={row.id} className="bg-white/50 dark:bg-transparent">
            <GlassTableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
              {row.code ?? "—"}
            </GlassTableCell>
            <GlassTableCell className="font-medium text-foreground">{row.name}</GlassTableCell>
            <GlassTableCell className="text-muted-foreground">{extraCell(row)}</GlassTableCell>
            <GlassTableCell>
              <span className={cn("text-xs", row.isActive ? "text-emerald-600" : "text-muted-foreground")}>
                {row.isActive ? "ใช้งาน" : "ปิด"}
              </span>
            </GlassTableCell>
            <GlassTableCell className="whitespace-nowrap text-right">
              {canManage && (
                <div className="inline-flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => onEdit(row)}
                  >
                    แก้ไข
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => onRemove(row.id)}
                  >
                    ลบ
                  </Button>
                </div>
              )}
            </GlassTableCell>
          </GlassTableRow>
        ))}
      </GlassTableBody>
    </GlassTable>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 border-b border-slate-200/70 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:border-white/10">
      {children}
    </p>
  )
}

function ExpenseTypeDialog({
  state,
  categories,
  centers,
  processes,
  onOpenChange,
  onSaved,
}: {
  state: { open: boolean; row?: ExpenseTypeOption }
  categories: ExpenseCategoryRow[]
  centers: CostCenterRow[]
  processes: ProcessRow[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const row = state.row
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [subcategory, setSubcategory] = useState("")
  const [description, setDescription] = useState("")
  const [transactionType, setTransactionType] = useState("EXPENSE")
  const [defaultCostType, setDefaultCostType] = useState("")
  const [defaultDirectness, setDefaultDirectness] = useState("")
  const [defaultGlLabel, setDefaultGlLabel] = useState("")
  const [requires, setRequires] = useState<Record<RequiredDimensionKey, boolean>>({
    requiresVendor: false,
    requiresVehicle: false,
    requiresMachine: false,
    requiresLocation: false,
    requiresCostCenter: false,
    requiresProcess: false,
  })
  const [allowedCenters, setAllowedCenters] = useState<Set<string>>(new Set())
  const [defaultCenter, setDefaultCenter] = useState("")
  const [allowedProcesses, setAllowedProcesses] = useState<Set<string>>(new Set())
  const [defaultProcess, setDefaultProcess] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state.open) return
    setName(row?.name ?? "")
    setCode(row?.code ?? "")
    setCategoryId(row?.categoryId ?? "")
    setSubcategory(row?.subcategory ?? "")
    setDescription(row?.description ?? "")
    setTransactionType(row?.transactionType ?? "EXPENSE")
    setDefaultCostType(row?.defaultCostType ?? "")
    setDefaultDirectness(row?.defaultDirectness ?? "")
    setDefaultGlLabel(row?.defaultGlLabel ?? "")
    setRequires({
      requiresVendor: row?.requiresVendor ?? false,
      requiresVehicle: row?.requiresVehicle ?? false,
      requiresMachine: row?.requiresMachine ?? false,
      requiresLocation: row?.requiresLocation ?? false,
      requiresCostCenter: row?.requiresCostCenter ?? false,
      requiresProcess: row?.requiresProcess ?? false,
    })
    setIsActive(row?.isActive ?? true)
    setError(null)
    setAllowedCenters(new Set())
    setDefaultCenter("")
    setAllowedProcesses(new Set())
    setDefaultProcess("")
    // Load existing mappings when editing.
    if (row) {
      void fetch(`/api/finance/expense-types/${row.id}/cost-centers`)
        .then((r) => r.json())
        .then((j) => {
          const maps = (j.data ?? []) as ExpenseTypeMapRow[]
          setAllowedCenters(new Set(maps.filter((m) => m.isAllowed).map((m) => m.targetId ?? "")))
          const def = maps.find((m) => m.isDefault)
          if (def) setDefaultCenter(def.targetId)
        })
        .catch(() => undefined)
      void fetch(`/api/finance/expense-types/${row.id}/processes`)
        .then((r) => r.json())
        .then((j) => {
          const maps = (j.data ?? []) as ExpenseTypeMapRow[]
          setAllowedProcesses(new Set(maps.filter((m) => m.isAllowed).map((m) => m.targetId ?? "")))
          const def = maps.find((m) => m.isDefault)
          if (def) setDefaultProcess(def.targetId)
        })
        .catch(() => undefined)
    }
  }, [state.open, row])

  function toggleCenter(id: string) {
    setAllowedCenters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        if (defaultCenter === id) setDefaultCenter("")
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleProcess(id: string) {
    setAllowedProcesses((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        if (defaultProcess === id) setDefaultProcess("")
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const costCenters = Array.from(allowedCenters).map((id) => ({
      costCenterId: id,
      isAllowed: true,
      isDefault: id === defaultCenter,
    }))
    const processesPayload = Array.from(allowedProcesses).map((id) => ({
      processId: id,
      isAllowed: true,
      isDefault: id === defaultProcess,
    }))

    const body = {
      name,
      code: code || null,
      categoryId: categoryId || null,
      subcategory: subcategory || null,
      description: description || null,
      transactionType,
      defaultCostType: defaultCostType || null,
      defaultDirectness: defaultDirectness || null,
      defaultGlLabel: defaultGlLabel || null,
      ...requires,
      costCenters,
      processes: processesPayload,
      isActive,
    }

    const res = await fetch(
      row ? `/api/finance/expense-types/${row.id}` : "/api/finance/expense-types",
      {
        method: row ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    )
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(typeof json.error === "string" ? json.error : json.error?.message ?? "บันทึกไม่สำเร็จ")
      return
    }
    onSaved()
  }

  return (
    <GlassDialog
      open={state.open}
      onOpenChange={onOpenChange}
      title={row ? "แก้ไขประเภทค่าใช้จ่าย" : "เพิ่มประเภทค่าใช้จ่าย"}
      className="max-w-2xl"
    >
      <GlassForm surfaced={false} onSubmit={onSubmit}>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <SectionLabel>ข้อมูลพื้นฐาน</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <GlassInput label="ชื่อ" required value={name} onChange={(e) => setName(e.target.value)} />
            <GlassInput
              label="รหัส (เว้นว่างเพื่อสร้างอัตโนมัติ)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Select
              label="หมวด"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={[
                { value: "", label: "— ไม่ระบุ —" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <GlassInput
              label="หมวดย่อย"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
            />
          </div>
          <GlassInput label="คำอธิบาย" value={description} onChange={(e) => setDescription(e.target.value)} />

          <SectionLabel>การจัดประเภทต้นทุน</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              label="ประเภทรายการ"
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              options={TX_TYPES.map((t) => ({ value: t, label: TX_TYPE_LABELS[t] }))}
            />
            <Select
              label="ลักษณะต้นทุน"
              value={defaultCostType}
              onChange={(e) => setDefaultCostType(e.target.value)}
              options={[
                { value: "", label: "— ไม่ระบุ —" },
                { value: "FIXED", label: COST_TYPE_LABELS.FIXED },
                { value: "VARIABLE", label: COST_TYPE_LABELS.VARIABLE },
                { value: "MIXED", label: COST_TYPE_LABELS.MIXED },
              ]}
            />
            <Select
              label="ทางตรง/ทางอ้อม"
              value={defaultDirectness}
              onChange={(e) => setDefaultDirectness(e.target.value)}
              options={[
                { value: "", label: "— ไม่ระบุ —" },
                { value: "DIRECT", label: DIRECTNESS_LABELS.DIRECT },
                { value: "INDIRECT", label: DIRECTNESS_LABELS.INDIRECT },
              ]}
            />
          </div>

          <SectionLabel>บัญชี (ชั่วคราว)</SectionLabel>
          <GlassInput
            label="ป้ายกำกับ GL (ข้อความชั่วคราว)"
            value={defaultGlLabel}
            onChange={(e) => setDefaultGlLabel(e.target.value)}
          />

          <SectionLabel>มิติที่ต้องระบุ (ข้อมูลอ้างอิง)</SectionLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {REQUIRED_DIMENSIONS.map((d) => (
              <label key={d.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requires[d.key]}
                  onChange={(e) => setRequires((prev) => ({ ...prev, [d.key]: e.target.checked }))}
                />
                <span>{d.label}</span>
              </label>
            ))}
          </div>

          <SectionLabel>หน่วยงานที่อนุญาต</SectionLabel>
          <MappingPicker
            items={centers.map((c) => ({ id: c.id, name: c.name }))}
            allowed={allowedCenters}
            defaultId={defaultCenter}
            onToggle={toggleCenter}
            onSetDefault={setDefaultCenter}
            emptyText="ยังไม่มีหน่วยงานที่ใช้งาน"
          />

          <SectionLabel>กระบวนการที่อนุญาต</SectionLabel>
          <MappingPicker
            items={processes.map((p) => ({ id: p.id, name: p.name }))}
            allowed={allowedProcesses}
            defaultId={defaultProcess}
            onToggle={toggleProcess}
            onSetDefault={setDefaultProcess}
            emptyText="ยังไม่มีกระบวนการที่ใช้งาน"
          />

          <SectionLabel>สถานะ</SectionLabel>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>ใช้งาน</span>
          </label>
        </div>

        <GlassFormActions>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button type="submit" loading={saving}>
            บันทึก
          </Button>
        </GlassFormActions>
      </GlassForm>
    </GlassDialog>
  )
}

/** Checkbox list of allowed targets with a single "default" radio among the allowed ones. */
function MappingPicker({
  items,
  allowed,
  defaultId,
  onToggle,
  onSetDefault,
  emptyText,
}: {
  items: { id: string; name: string }[]
  allowed: Set<string>
  defaultId: string
  onToggle: (id: string) => void
  onSetDefault: (id: string) => void
  emptyText: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }
  return (
    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200/70 p-2 dark:border-white/10">
      {items.map((it) => {
        const isAllowed = allowed.has(it.id)
        return (
          <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isAllowed} onChange={() => onToggle(it.id)} />
              <span>{it.name}</span>
            </label>
            <label className={cn("flex items-center gap-1 text-xs", !isAllowed && "opacity-40")}>
              <input
                type="radio"
                name={`default-${items[0]?.id ?? "x"}`}
                disabled={!isAllowed}
                checked={defaultId === it.id}
                onChange={() => onSetDefault(it.id)}
              />
              <span>ค่าเริ่มต้น</span>
            </label>
          </div>
        )
      })}
    </div>
  )
}

function CategoryDialog({
  state,
  categories,
  onOpenChange,
  onSaved,
}: {
  state: { open: boolean; row?: ExpenseCategoryRow }
  categories: ExpenseCategoryRow[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const row = state.row
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [parentId, setParentId] = useState("")
  const [description, setDescription] = useState("")
  const [sequence, setSequence] = useState("0")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state.open) return
    setName(row?.name ?? "")
    setCode(row?.code ?? "")
    setParentId(row?.parentId ?? "")
    setDescription(row?.description ?? "")
    setSequence(String(row?.sequence ?? 0))
    setIsActive(row?.isActive ?? true)
    setError(null)
  }, [state.open, row])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch(
      row ? `/api/finance/expense-categories/${row.id}` : "/api/finance/expense-categories",
      {
        method: row ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code: code || null,
          parentId: parentId || null,
          description: description || null,
          sequence: Number(sequence) || 0,
          isActive,
        }),
      }
    )
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(typeof json.error === "string" ? json.error : json.error?.message ?? "บันทึกไม่สำเร็จ")
      return
    }
    onSaved()
  }

  const parentOptions = categories.filter((c) => c.id !== row?.id)

  return (
    <GlassDialog
      open={state.open}
      onOpenChange={onOpenChange}
      title={row ? "แก้ไขหมวดค่าใช้จ่าย" : "เพิ่มหมวดค่าใช้จ่าย"}
      className="max-w-md"
    >
      <GlassForm surfaced={false} onSubmit={onSubmit}>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <GlassInput label="ชื่อ" required value={name} onChange={(e) => setName(e.target.value)} />
        <GlassInput label="รหัส (เว้นว่างเพื่อสร้างอัตโนมัติ)" value={code} onChange={(e) => setCode(e.target.value)} />
        <Select
          label="หมวดแม่"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          options={[
            { value: "", label: "— ไม่มี —" },
            ...parentOptions.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <GlassInput label="คำอธิบาย" value={description} onChange={(e) => setDescription(e.target.value)} />
        <GlassInput
          label="ลำดับ"
          type="number"
          value={sequence}
          onChange={(e) => setSequence(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>ใช้งาน</span>
        </label>
        <GlassFormActions>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button type="submit" loading={saving}>
            บันทึก
          </Button>
        </GlassFormActions>
      </GlassForm>
    </GlassDialog>
  )
}

function ProcessDialog({
  state,
  processes,
  onOpenChange,
  onSaved,
}: {
  state: { open: boolean; row?: ProcessRow }
  processes: ProcessRow[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const row = state.row
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [parentId, setParentId] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state.open) return
    setName(row?.name ?? "")
    setCode(row?.code ?? "")
    setParentId(row?.parentId ?? "")
    setIsActive(row?.isActive ?? true)
    setError(null)
  }, [state.open, row])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch(row ? `/api/finance/processes/${row.id}` : "/api/finance/processes", {
      method: row ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code: code || null, parentId: parentId || null, isActive }),
    })
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(typeof json.error === "string" ? json.error : json.error?.message ?? "บันทึกไม่สำเร็จ")
      return
    }
    onSaved()
  }

  const parentOptions = processes.filter((p) => p.id !== row?.id)

  return (
    <GlassDialog
      open={state.open}
      onOpenChange={onOpenChange}
      title={row ? "แก้ไขกระบวนการ" : "เพิ่มกระบวนการ"}
      className="max-w-md"
    >
      <GlassForm surfaced={false} onSubmit={onSubmit}>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <GlassInput label="ชื่อ" required value={name} onChange={(e) => setName(e.target.value)} />
        <GlassInput label="รหัส (เว้นว่างเพื่อสร้างอัตโนมัติ)" value={code} onChange={(e) => setCode(e.target.value)} />
        <Select
          label="กระบวนการแม่"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          options={[
            { value: "", label: "— ไม่มี —" },
            ...parentOptions.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>ใช้งาน</span>
        </label>
        <GlassFormActions>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button type="submit" loading={saving}>
            บันทึก
          </Button>
        </GlassFormActions>
      </GlassForm>
    </GlassDialog>
  )
}

function CostCenterDialog({
  state,
  onOpenChange,
  onSaved,
}: {
  state: { open: boolean; row?: CostCenterRow }
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const row = state.row
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (state.open) {
      setName(row?.name ?? "")
      setCode(row?.code ?? "")
      setIsActive(row?.isActive ?? true)
      setError(null)
    }
  }, [state.open, row])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch(
      row ? `/api/finance/cost-centers/${row.id}` : "/api/finance/cost-centers",
      {
        method: row ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code: code || null, isActive }),
      }
    )
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(typeof json.error === "string" ? json.error : json.error?.message ?? "บันทึกไม่สำเร็จ")
      return
    }
    onSaved()
  }

  return (
    <GlassDialog
      open={state.open}
      onOpenChange={onOpenChange}
      title={row ? "แก้ไขหน่วยงาน" : "เพิ่มหน่วยงาน"}
      className="max-w-md"
    >
      <GlassForm surfaced={false} onSubmit={onSubmit}>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <GlassInput label="ชื่อ" required value={name} onChange={(e) => setName(e.target.value)} />
        <GlassInput label="รหัส (เว้นว่างเพื่อสร้างอัตโนมัติ)" value={code} onChange={(e) => setCode(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>ใช้งาน</span>
        </label>
        <GlassFormActions>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button type="submit" loading={saving}>
            บันทึก
          </Button>
        </GlassFormActions>
      </GlassForm>
    </GlassDialog>
  )
}
