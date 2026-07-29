"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { getModuleAccessGroups } from "@/shared/permissions/module-access-groups"

export type ModuleAccessValue = string[] | "all" | null | undefined

interface ModuleAccessPickerProps {
  value: ModuleAccessValue
  onChange: (v: ModuleAccessValue) => void
  /** แสดงตัวเลือก "ใช้ตาม Role ที่กำหนด" (null) — ใช้สำหรับ override รายบุคคลที่หน้า User เท่านั้น */
  allowInherit?: boolean
}

export function ModuleAccessPicker({ value, onChange, allowInherit = false }: ModuleAccessPickerProps) {
  const moduleGroups = useMemo(() => getModuleAccessGroups(), [])
  const isInherit = allowInherit && (value === null || value === undefined)
  const isAll = value === "all" || (!allowInherit && value === undefined)
  const selected: string[] = Array.isArray(value) ? value : []

  const handleRadio = (mode: "inherit" | "all" | "specific") => {
    if (mode === "inherit") onChange(null)
    else if (mode === "all") onChange("all")
    else onChange([])
  }

  const toggleModule = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    onChange(next)
  }

  const allModuleIds = moduleGroups.flatMap((g) => g.modules.map((m) => m.id))
  const selectAllModules = () => onChange(allModuleIds)
  const clearModules = () => onChange([])

  const optionClass =
    "flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/60"

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        {allowInherit && (
          <label className={optionClass}>
            <input
              type="radio"
              name="moduleAccess"
              checked={isInherit}
              onChange={() => handleRadio("inherit")}
              className="h-4 w-4 border-input text-blue-600"
            />
            <div>
              <span className="text-sm font-semibold text-foreground">ใช้ตามสิทธิ์อ่านของ Role</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ค่าเริ่มต้น — มองเห็นโมดูลตามสิทธิ์อ่านที่ Role กำหนด (ไม่มี override เพิ่ม)
              </p>
            </div>
          </label>
        )}

        <label className={optionClass}>
          <input
            type="radio"
            name="moduleAccess"
            checked={isAll}
            onChange={() => handleRadio("all")}
            className="h-4 w-4 border-input text-blue-600"
          />
          <div>
            <span className="text-sm font-semibold text-foreground">เข้าได้ทุกโมดูล</span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ไม่จำกัดการมองเห็นโมดูล (ยังอยู่ภายใต้สิทธิ์ resource)
            </p>
          </div>
        </label>

        <label className={optionClass}>
          <input
            type="radio"
            name="moduleAccess"
            checked={!isAll && !isInherit}
            onChange={() => handleRadio("specific")}
            className="h-4 w-4 border-input text-blue-600"
          />
          <div>
            <span className="text-sm font-semibold text-foreground">เลือกเฉพาะโมดูล</span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              จำกัดการมองเห็นเฉพาะโมดูลที่เลือก
              {allowInherit ? " (override เฉพาะผู้ใช้คนนี้)" : ""}
            </p>
          </div>
        </label>
      </div>

      {!isAll && !isInherit && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              เลือกโมดูล ({selected.length}/{allModuleIds.length})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllModules}
                className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                เลือกทั้งหมด
              </button>
              <span className="text-muted-foreground/40">|</span>
              <button
                type="button"
                onClick={clearModules}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ล้าง
              </button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {moduleGroups.map(({ group, modules }) => (
              <div key={group} className="px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {modules.map(({ id, label }) => {
                    const checked = selected.includes(id)
                    return (
                      <label
                        key={id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          checked
                            ? "bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200"
                            : "text-foreground hover:bg-muted/60"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleModule(id)}
                          className="h-3.5 w-3.5 rounded border-input text-blue-600 focus:ring-blue-500"
                        />
                        {label}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
