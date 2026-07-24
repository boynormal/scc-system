"use client"

import { cn } from "@/lib/utils"

export type ModuleAccessValue = string[] | "all" | null | undefined

/** โมดูลทั้งหมดที่กำหนดสิทธิ์ได้ จัดกลุ่มตามสายงาน */
const MODULE_GROUPS: { group: string; modules: { id: string; label: string }[] }[] = [
  {
    group: "การจัดการซ่อมบำรุง",
    modules: [
      { id: "machines", label: "เครื่องจักร" },
      { id: "maintenance", label: "แผน / ตาราง / ปฏิทิน" },
      { id: "dashboard", label: "Dashboard" },
      { id: "work_orders", label: "ใบสั่งงาน" },
      { id: "reports", label: "รายงาน" },
      { id: "notifications", label: "การแจ้งเตือน" },
    ],
  },
  {
    group: "สินค้าคงคลัง",
    modules: [{ id: "spare_parts", label: "อะไหล่" }],
  },
  {
    group: "บุคลากรและเวลา",
    modules: [
      { id: "hr_personnel", label: "ข้อมูลบุคลากร" },
      { id: "hr_attendance", label: "บันทึกเวลา" },
    ],
  },
  {
    group: "ตั้งค่า",
    modules: [{ id: "settings", label: "ตั้งค่าและผู้ดูแลระบบ" }],
  },
]

interface ModuleAccessPickerProps {
  value: ModuleAccessValue
  onChange: (v: ModuleAccessValue) => void
  /** แสดงตัวเลือก "ใช้ตาม Role ที่กำหนด" (null) — ใช้สำหรับ override รายบุคคลที่หน้า User เท่านั้น */
  allowInherit?: boolean
}

export function ModuleAccessPicker({ value, onChange, allowInherit = false }: ModuleAccessPickerProps) {
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

  const allModuleIds = MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.id))

  const selectAllModules = () => onChange(allModuleIds)
  const clearModules = () => onChange([])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        {allowInherit && (
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <input
              type="radio"
              name="moduleAccess"
              checked={isInherit}
              onChange={() => handleRadio("inherit")}
              className="w-4 h-4 text-blue-600 border-slate-300"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800">ใช้ตาม Role ที่กำหนด</span>
              <p className="text-xs text-slate-500 mt-0.5">ค่าเริ่มต้น — มองเห็นโมดูลตามที่ตั้งไว้ที่ Role ของผู้ใช้คนนี้</p>
            </div>
          </label>
        )}

        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          <input
            type="radio"
            name="moduleAccess"
            checked={isAll}
            onChange={() => handleRadio("all")}
            className="w-4 h-4 text-blue-600 border-slate-300"
          />
          <div>
            <span className="text-sm font-semibold text-slate-800">เข้าได้ทุกโมดูล</span>
            <p className="text-xs text-slate-500 mt-0.5">ไม่จำกัดการเข้าถึงโมดูลใดๆ (ยังอยู่ภายใต้สิทธิ์ resource)</p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          <input
            type="radio"
            name="moduleAccess"
            checked={!isAll && !isInherit}
            onChange={() => handleRadio("specific")}
            className="w-4 h-4 text-blue-600 border-slate-300"
          />
          <div>
            <span className="text-sm font-semibold text-slate-800">เลือกเฉพาะโมดูล</span>
            <p className="text-xs text-slate-500 mt-0.5">จำกัดการมองเห็นเฉพาะโมดูลที่เลือก{allowInherit ? " (override เฉพาะผู้ใช้คนนี้)" : ""}</p>
          </div>
        </label>
      </div>

      {!isAll && !isInherit && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              เลือกโมดูล ({selected.length}/{allModuleIds.length})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllModules}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                เลือกทั้งหมด
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={clearModules}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                ล้าง
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {MODULE_GROUPS.map(({ group, modules }) => (
              <div key={group} className="px-4 py-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {modules.map(({ id, label }) => {
                    const checked = selected.includes(id)
                    return (
                      <label
                        key={id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
                          checked ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50 text-slate-700"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleModule(id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
