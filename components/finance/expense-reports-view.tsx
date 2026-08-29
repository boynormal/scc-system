"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { GlassInput } from "@/components/glass"
import {
  GlassCard,
  GlassTable,
  GlassTableBody,
  GlassTableCell,
  GlassTableHead,
  GlassTableHeader,
  GlassTableRow,
} from "@/components/glass"
import { FinancePageHeader } from "./finance-page-header"
import { FIN_GLASS_FIELD, FIN_GLASS_PANEL, SOURCE_MODULE_LABELS, formatBaht } from "./finance-theme"

type Bucket = { key: string; label: string; total: number; count: number }

type ReportData = {
  grandTotal: number
  count: number
  byModule: Bucket[]
  byBranch: Bucket[]
  byCostCenter: Bucket[]
  byType: Bucket[]
  byMonth: Bucket[]
}

const EMPTY: ReportData = {
  grandTotal: 0,
  count: 0,
  byModule: [],
  byBranch: [],
  byCostCenter: [],
  byType: [],
  byMonth: [],
}

function ReportTable({
  title,
  rows,
  translateLabel,
}: {
  title: string
  rows: Bucket[]
  translateLabel?: (key: string, label: string) => string
}) {
  return (
    <GlassCard className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>
      ) : (
        <GlassTable>
          <GlassTableHeader>
            <tr>
              <GlassTableHead>รายการ</GlassTableHead>
              <GlassTableHead className="whitespace-nowrap text-right">จำนวน</GlassTableHead>
              <GlassTableHead className="whitespace-nowrap text-right">ยอดรวม</GlassTableHead>
            </tr>
          </GlassTableHeader>
          <GlassTableBody>
            {rows.map((r) => (
              <GlassTableRow key={r.key}>
                <GlassTableCell className="text-foreground">
                  {translateLabel ? translateLabel(r.key, r.label) : r.label}
                </GlassTableCell>
                <GlassTableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                  {r.count}
                </GlassTableCell>
                <GlassTableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-foreground">
                  {formatBaht(r.total)}
                </GlassTableCell>
              </GlassTableRow>
            ))}
          </GlassTableBody>
        </GlassTable>
      )}
    </GlassCard>
  )
}

export function ExpenseReportsView() {
  const [data, setData] = useState<ReportData>(EMPTY)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    const res = await fetch(`/api/finance/reports?${params}`)
    const json = await res.json().catch(() => ({}))
    if (res.ok && json?.data) setData(json.data as ReportData)
  }, [dateFrom, dateTo])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="รายงานค่าใช้จ่าย"
        description="สรุปตามโมดูล สาขา หน่วยงาน และประเภท (ไม่รวมรายการยกเลิก/ปฏิเสธ)"
      />

      <GlassCard className={cn("flex flex-wrap items-end gap-3 rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
        <GlassInput
          label="ตั้งแต่วันที่"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={FIN_GLASS_FIELD}
        />
        <GlassInput
          label="ถึงวันที่"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={FIN_GLASS_FIELD}
        />
        <div className="ml-auto rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2 text-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <span className="text-muted-foreground">ยอดรวมทั้งหมด: </span>
          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
            {formatBaht(data.grandTotal)}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">({data.count} รายการ)</span>
        </div>
      </GlassCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <ReportTable
          title="ตามโมดูลต้นทาง"
          rows={data.byModule}
          translateLabel={(key) => SOURCE_MODULE_LABELS[key] ?? key}
        />
        <ReportTable title="ตามสาขา" rows={data.byBranch} />
        <ReportTable title="ตามหน่วยงาน" rows={data.byCostCenter} />
        <ReportTable title="ตามประเภท" rows={data.byType} />
        <ReportTable title="ตามเดือน" rows={data.byMonth} />
      </div>
    </div>
  )
}
