"use client"

import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import type { IncomeCategoryRow, IncomeTypeOption } from "./income-types"

const selectedMenuClass =
  "bg-gradient-to-b from-rose-400 via-rose-500 to-rose-600 text-white shadow-[0_8px_16px_rgb(244_63_94/0.45),inset_0_1px_0_rgb(255_255_255/0.7)] ring-1 ring-white/50"
const idleMenuClass = "border border-border bg-background text-foreground hover:bg-muted"

/** `null` = no category chosen yet, `""` = types without a category. */
export function defaultIncomeCategoryId(types: IncomeTypeOption[], categories: IncomeCategoryRow[]): string | null {
  const activeTypes = types.filter((x) => x.isActive)
  const first = categories.find((c) => c.isActive && activeTypes.some((x) => x.categoryId === c.id))
  if (first) return first.id
  if (activeTypes.some((x) => !x.categoryId)) return ""
  return null
}

export function IncomeTypePicker({
  types,
  categories,
  categoryId,
  typeId,
  disabled,
  onPickCategory,
  onPickType,
}: {
  types: IncomeTypeOption[]
  categories: IncomeCategoryRow[]
  categoryId: string | null
  typeId: string
  disabled: boolean
  onPickCategory: (id: string) => void
  onPickType: (id: string) => void
}) {
  const t = useTranslations("financeIncome")
  const menuTypes = types.filter((x) => x.isActive || x.id === typeId)
  const currentType = menuTypes.find((x) => x.id === typeId)
  const categoryOptions = categories.filter((c) => c.isActive || c.id === categoryId || c.id === currentType?.categoryId)
  const showUncategorized = menuTypes.some((x) => !x.categoryId)
  const visibleTypes =
    categoryId === null ? [] : menuTypes.filter((x) => (x.categoryId ?? "") === categoryId || x.id === typeId)

  return (
    <div className="space-y-3">
      {disabled && <p className="text-sm text-foreground">{t("pickerReceivedHint")}</p>}

      <div className="grid items-start gap-3 sm:grid-cols-[minmax(7.5rem,11rem)_minmax(0,1fr)] sm:gap-0">
        <div className="min-w-0 border-b border-border pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
          <h3 className="mb-2 text-sm font-medium text-foreground">{t("incomeCategory")}</h3>
          {categoryOptions.length === 0 && !showUncategorized ? (
            <p className="rounded-lg border border-dashed border-border px-2 py-4 text-center text-sm text-foreground">
              {t("noTypeOptions")}
            </p>
          ) : (
            <div
              className="flex gap-1.5 overflow-x-auto sm:max-h-[30rem] sm:flex-col sm:overflow-y-auto sm:pr-1"
              role="group"
              aria-label={t("incomeCategory")}
            >
              {categoryOptions.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={categoryId === category.id}
                  onClick={() => onPickCategory(category.id)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center whitespace-normal break-words rounded-lg px-3 py-2 text-left text-sm font-medium sm:w-full",
                    categoryId === category.id ? selectedMenuClass : idleMenuClass
                  )}
                >
                  {category.name}
                </button>
              ))}
              {showUncategorized && (
                <button
                  type="button"
                  aria-pressed={categoryId === ""}
                  onClick={() => onPickCategory("")}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-left text-sm font-medium sm:w-full",
                    categoryId === "" ? selectedMenuClass : idleMenuClass
                  )}
                >
                  {t("unspecified")}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 sm:pl-3">
          <h3 className="mb-2 text-sm font-medium text-foreground">
            {t("type")}
            <span className="ml-1 text-red-500">*</span>
          </h3>
          {categoryId === null ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-foreground">
              {t("selectIncomeCategory")}
            </p>
          ) : visibleTypes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-foreground">
              {t("noTypeOptions")}
            </p>
          ) : (
            <div
              className="grid gap-2 sm:max-h-[30rem] sm:overflow-y-auto sm:pr-1 md:grid-cols-2 2xl:grid-cols-3"
              role="group"
              aria-label={t("type")}
            >
              {visibleTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  aria-pressed={typeId === type.id}
                  disabled={disabled}
                  onClick={() => onPickType(type.id)}
                  className={cn(
                    "flex min-h-14 w-full items-center whitespace-normal break-words rounded-lg px-3 py-2 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
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
    </div>
  )
}
