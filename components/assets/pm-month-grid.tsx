"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { GlassDialog } from "@/components/glass"
import type { PmMonthCell } from "@/modules/assets/application/asset-pm-service"

export type PmMonthRow = {
  assetId: string
  name: string
  code: string
  branchName: string
  cells: Record<string, PmMonthCell>
}

export function PmMonthGrid({
  rows,
  year,
  month,
  daysInMonth,
  todayKey,
}: {
  rows: PmMonthRow[]
  year: number
  month: number
  daysInMonth: number
  todayKey: string
}) {
  const t = useTranslations("pmCheck")
  const [open, setOpen] = useState<{
    assetName: string
    day: number
    cell: PmMonthCell
  } | null>(null)
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1)
  const isSunday = (day: number) => {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00+07:00`
    return new Date(iso).getUTCDay() === 0
  }

  return (
    <>
      <div className="w-full overflow-x-auto rounded-xl border border-[#cbd5e1] bg-[#ffffff] shadow-sm">
        <table
          className="w-full table-fixed border-separate border-spacing-0 bg-[#ffffff] text-xs"
          style={{ minWidth: `max(100%, calc(7rem + ${daysInMonth} * 1.75rem))` }}
        >
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-28 border-b border-r border-[#cbd5e1] bg-[#e2e8f0] px-2 py-2 text-left text-xs font-semibold text-[#0f172a] sm:w-44 sm:px-3">
                {t("assetColumn")}
              </th>
              {days.map((day) => {
                const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                const isToday = key === todayKey
                const sunday = isSunday(day)
                return (
                  <th
                    key={day}
                    className={`border-b border-[#cbd5e1] px-0.5 py-2 text-center font-semibold ${
                      isToday
                        ? "bg-[#2563eb] text-white"
                        : sunday
                          ? "bg-[#fecdd3] text-[#9f1239]"
                          : "bg-[#e2e8f0] text-[#0f172a]"
                    }`}
                  >
                    {day}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.assetId}>
                <th className="sticky left-0 z-10 w-28 border-b border-r border-[#cbd5e1] bg-[#ffffff] px-2 py-2 text-left font-medium text-[#0f172a] sm:w-44 sm:px-3">
                  <span className="block truncate">{row.name}</span>
                  <span className="block truncate text-[11px] font-normal text-[#475569]">{row.branchName}</span>
                </th>
                {days.map((day) => {
                  const cell = row.cells[String(day)]
                  const sunday = isSunday(day)
                  const label = cell
                    ? `${row.name} ${day} ${cell.status === "fail" ? t("fail") : t("pass")}`
                    : `${row.name} ${day}`
                  return (
                    <td
                      key={day}
                      className={`border-b border-[#e2e8f0] p-1 text-center ${sunday ? "bg-[#ffe4e6]" : "bg-[#ffffff]"}`}
                    >
                      <button
                        type="button"
                        disabled={!cell}
                        aria-label={label}
                        onClick={() => cell && setOpen({ assetName: row.name, day, cell })}
                        className={`block h-8 w-full rounded ${
                          cell?.status === "fail"
                            ? "bg-[#facc15] hover:bg-[#eab308]"
                            : cell?.status === "pass"
                              ? "bg-[#059669] hover:bg-[#047857]"
                              : sunday
                                ? "bg-[#fda4af]"
                                : "bg-[#cbd5e1]"
                        } disabled:cursor-default`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GlassDialog
        solid
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null)
        }}
        title={open ? `${open.assetName} · ${open.day}` : t("calendarTitle")}
      >
        {open && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {open.cell.status === "fail" ? t("fail") : t("pass")}
              {open.cell.roundCount > 1 ? ` · ${t("roundCount", { count: open.cell.roundCount })}` : ""}
            </p>
            <ul className="space-y-2 text-sm">
              {open.cell.results.map((result) => (
                <li key={`${result.sequence}-${result.itemName}`}>
                  <span className="font-medium text-foreground">
                    {result.sequence}. {result.itemName}
                  </span>
                  <span className="text-muted-foreground">
                    {" — "}
                    {result.status === "pass" || result.status === "fail" || result.status === "na"
                      ? t(result.status)
                      : result.status}
                    {result.remark ? ` (${result.remark})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </GlassDialog>
    </>
  )
}
