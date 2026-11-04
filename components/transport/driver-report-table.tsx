"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Users } from "lucide-react"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import type { DriverReportRow, LicenseReadiness } from "@/modules/transport/application/driver-report"

type SortKey = keyof Pick<
  DriverReportRow,
  | "jobCount"
  | "completedCount"
  | "incompleteCheckins"
  | "missingLocations"
  | "completeCheckins"
  | "totalKm"
  | "unmeasuredJobs"
  | "longDwells"
  | "slowTravels"
>

const LICENSE_VARIANT: Record<LicenseReadiness, "success" | "warning" | "danger" | "default"> = {
  ok: "success",
  expiring: "warning",
  expired: "danger",
  missing: "default",
}

const NUMBER_COLUMNS: { key: SortKey; labelKey: string; hide: boolean }[] = [
  { key: "jobCount", labelKey: "reportsJobs", hide: false },
  { key: "completedCount", labelKey: "reportsCompleted", hide: true },
  { key: "incompleteCheckins", labelKey: "reportsIncomplete", hide: false },
  { key: "missingLocations", labelKey: "reportsMissingLocation", hide: false },
  { key: "completeCheckins", labelKey: "reportsComplete", hide: false },
  { key: "totalKm", labelKey: "reportsKm", hide: true },
  { key: "unmeasuredJobs", labelKey: "reportsUnmeasured", hide: true },
  { key: "longDwells", labelKey: "reportsLongDwell", hide: true },
  { key: "slowTravels", labelKey: "reportsSlow", hide: true },
]

function cellClass(hide: boolean) {
  return hide ? "px-2 py-2 text-right hidden xl:table-cell" : "px-2 py-2 text-right"
}

export function DriverReportTable({ rows }: { rows: DriverReportRow[] }) {
  const t = useTranslations("transport")
  const [sortKey, setSortKey] = useState<SortKey>("incompleteCheckins")
  const [descending, setDescending] = useState(true)

  const sorted = useMemo(() => {
    const next = [...rows]
    next.sort((a, b) => {
      const delta = a[sortKey] - b[sortKey]
      if (delta !== 0) return descending ? -delta : delta
      return a.name.localeCompare(b.name, "th")
    })
    return next
  }, [rows, sortKey, descending])

  const sortBy = (key: SortKey) => {
    if (key === sortKey) {
      setDescending((value) => !value)
      return
    }
    setSortKey(key)
    setDescending(true)
  }

  if (rows.length === 0) {
    return (
      <AppDataTablePanel>
        <EmptyState icon={Users} title={t("reportsEmpty")} />
      </AppDataTablePanel>
    )
  }

  return (
    <AppDataTablePanel>
      <AppDataTable>
        <AppDataTableHead dense>
          <tr>
            <th className="text-left">{t("reportsDriver")}</th>
            <th className="hidden text-left xl:table-cell">{t("reportsBranch")}</th>
            <th className="hidden text-left xl:table-cell">{t("reportsVehicle")}</th>
            <th className="hidden text-left xl:table-cell">{t("reportsLicense")}</th>
            {NUMBER_COLUMNS.map((column) => (
              <th key={column.key} className={column.hide ? "hidden xl:table-cell" : undefined}>
                <button
                  type="button"
                  onClick={() => sortBy(column.key)}
                  className="text-left font-semibold text-foreground"
                >
                  {t(column.labelKey)}
                  {sortKey === column.key ? (descending ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </AppDataTableHead>
        <AppDataTableBody>
          {sorted.map((row) => (
            <tr key={row.driverId}>
              <td className="px-2 py-2">
                <Link
                  href={`/transport/jobs?search=${encodeURIComponent(row.name.split(" ")[0] ?? row.name)}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {row.name}
                </Link>
              </td>
              <td className="hidden px-2 py-2 text-foreground xl:table-cell">{row.branchName}</td>
              <td className="hidden px-2 py-2 text-foreground xl:table-cell">{row.vehiclePlate ?? "—"}</td>
              <td className="hidden px-2 py-2 xl:table-cell">
                <Badge variant={LICENSE_VARIANT[row.license]}>{t(`reportsLicense_${row.license}`)}</Badge>
              </td>
              {NUMBER_COLUMNS.map((column) => (
                <td key={column.key} className={`${cellClass(column.hide)} text-foreground`}>
                  {column.key === "totalKm" ? row.totalKm.toLocaleString() : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </AppDataTableBody>
      </AppDataTable>
    </AppDataTablePanel>
  )
}
