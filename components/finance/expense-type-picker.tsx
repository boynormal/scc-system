"use client"

import { cn } from "@/lib/utils"
import type { ExpenseTypeOption } from "./expense-types"

const selectedMenuClass =
  "bg-gradient-to-b from-rose-400 via-rose-500 to-rose-600 text-white shadow-[0_8px_16px_rgb(244_63_94/0.45),inset_0_1px_0_rgb(255_255_255/0.7)] ring-1 ring-white/50"
const idleMenuClass = "border border-border bg-background text-foreground hover:bg-muted"

export const UNCATEGORIZED_EXPENSE = "__none__"

export type ExpenseTypeGroup = { key: string; label: string; items: ExpenseTypeOption[] }

export function expenseTypeGroups(types: ExpenseTypeOption[], keepId: string): ExpenseTypeGroup[] {
  const map = new Map<string, ExpenseTypeGroup>()
  for (const t of types) {
    if (!t.isActive && t.id !== keepId) continue
    const key = t.categoryId ?? UNCATEGORIZED_EXPENSE
    const label = t.categoryName?.trim() || "อื่นๆ"
    const g = map.get(key) ?? { key, label, items: [] }
    g.items.push(t)
    map.set(key, g)
  }
  return [...map.values()]
}

export function defaultExpenseCategoryKey(types: ExpenseTypeOption[], typeId: string): string | null {
  const groups = expenseTypeGroups(types, typeId)
  const current = types.find((t) => t.id === typeId)
  if (current) return current.categoryId ?? UNCATEGORIZED_EXPENSE
  return groups[0]?.key ?? null
}

export function ExpenseTypePicker({
  types,
  categoryKey,
  typeId,
  onPickCategory,
  onPickType,
}: {
  types: ExpenseTypeOption[]
  categoryKey: string | null
  typeId: string
  onPickCategory: (key: string) => void
  onPickType: (id: string) => void
}) {
  const groups = expenseTypeGroups(types, typeId)
  const visibleTypes = groups.find((g) => g.key === categoryKey)?.items ?? []

  return (
    <div className="-mx-5 -my-4 grid min-h-[40rem] items-start gap-3 sm:grid-cols-[minmax(16rem,max-content)_minmax(0,1fr)] sm:items-stretch sm:gap-0">
      <div className="flex flex-col border-b border-border bg-[#e8eef8] px-5 py-4 dark:border-white/10 dark:bg-[#1e293b] sm:border-b-0 sm:border-r">
        <h3 className="mb-2 text-sm font-medium text-foreground">หมวดค่าใช้จ่าย</h3>
        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-2 py-4 text-center text-sm text-foreground">
            ไม่มีประเภทค่าใช้จ่าย
          </p>
        ) : (
          <div
            className="flex flex-1 gap-1.5 overflow-x-auto sm:flex-col sm:overflow-visible"
            role="group"
            aria-label="หมวดค่าใช้จ่าย"
          >
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                aria-pressed={categoryKey === g.key}
                onClick={() => onPickCategory(g.key)}
                className={cn(
                  "flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-4 py-2 text-left text-sm font-medium sm:w-full sm:flex-1",
                  categoryKey === g.key ? selectedMenuClass : idleMenuClass
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 px-5 py-4">
        <h3 className="mb-2 text-sm font-medium text-foreground">
          ประเภทค่าใช้จ่าย
          <span className="ml-1 text-red-500">*</span>
        </h3>
        {categoryKey === null ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-foreground">
            เลือกหมวดค่าใช้จ่ายก่อน
          </p>
        ) : visibleTypes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-foreground">
            ไม่มีประเภทในหมวดนี้
          </p>
        ) : (
          <div
            className="grid gap-2 sm:max-h-[30rem] sm:overflow-y-auto sm:pr-1 md:grid-cols-2 2xl:grid-cols-3"
            role="group"
            aria-label="ประเภทค่าใช้จ่าย"
          >
            {visibleTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                aria-pressed={typeId === type.id}
                onClick={() => onPickType(type.id)}
                className={cn(
                  "flex min-h-14 w-full items-center whitespace-normal break-words rounded-lg px-3 py-2 text-left text-sm font-medium",
                  typeId === type.id ? selectedMenuClass : idleMenuClass
                )}
              >
                {type.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
