import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { BarChart3 } from "lucide-react"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import {
  fuelReportQuerySchema,
  getFuelConsumptionReport,
  getFuelMovementReport,
  listFuelBranches,
} from "@/modules/fuel"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { ListFrame } from "@/components/shell/list-frame"
import { SubTabs } from "@/components/shell/sub-tabs"
import { EmptyState } from "@/components/ui/empty-state"
import { FuelFilters } from "@/components/fuel/fuel-filters"
import { fmtMoney, fmtQty } from "@/components/fuel/fuel-format"

export async function generateMetadata() {
  const t = await getTranslations("fuel")
  return { title: t("reportsTitle") }
}

function defaultRange() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return { dateFrom: `${now.toISOString().slice(0, 7)}-01`, dateTo: now.toISOString().slice(0, 10) }
}

export default async function FuelReportsPage(props: {
  searchParams: Promise<{ view?: string; branchId?: string; dateFrom?: string; dateTo?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const t = await getTranslations("fuel")
  const sp = await props.searchParams
  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string
  const view = sp.view === "consumption" ? "consumption" : "movement"
  const range = defaultRange()
  const parsed = fuelReportQuerySchema.safeParse({
    branchId: sp.branchId || null,
    dateFrom: sp.dateFrom || range.dateFrom,
    dateTo: sp.dateTo || range.dateTo,
  })
  const query = parsed.success ? parsed.data : { dateFrom: range.dateFrom, dateTo: range.dateTo }
  const branches = await listFuelBranches(prisma, { companyId, roles })

  const tabHref = (v: string) => {
    const params = new URLSearchParams()
    params.set("view", v)
    if (sp.branchId) params.set("branchId", sp.branchId)
    if (sp.dateFrom) params.set("dateFrom", sp.dateFrom)
    if (sp.dateTo) params.set("dateTo", sp.dateTo)
    return `/fuel/reports?${params.toString()}`
  }

  const header = (
    <SubTabs
      items={[
        { key: "movement", label: t("reportMovement"), href: tabHref("movement") },
        { key: "consumption", label: t("reportConsumption"), href: tabHref("consumption") },
      ]}
      activeKey={view}
    />
  )

  const filters = (
    <Suspense fallback={null}>
      <FuelFilters branches={branches.data} dates />
    </Suspense>
  )
  const periodNote = `${query.dateFrom ?? "…"} – ${query.dateTo ?? "…"}`

  if (view === "movement") {
    const report = await getFuelMovementReport(prisma, { companyId, roles, query })
    return (
      <ListFrame title={t("reportsTitle")} description={`${t("reportsDesc")} · ${periodNote}`} filters={filters} plainPanel>
        {header}
        <AppDataTablePanel className="mt-3">
          {report.data.length === 0 ? (
            <EmptyState icon={BarChart3} title={t("noData")} />
          ) : (
            <AppDataTable>
              <AppDataTableHead>
                <tr>
                  <th>{t("tank")}</th>
                  <th className="hidden lg:table-cell">{t("branch")}</th>
                  <th>{t("fuelType")}</th>
                  <th className="text-right">{t("received")}</th>
                  <th className="hidden text-right xl:table-cell">{t("receivedCost")}</th>
                  <th className="text-right">{t("dispensed")}</th>
                  <th className="hidden text-right xl:table-cell">{t("dispensedCost")}</th>
                  <th className="text-right">{t("adjusted")}</th>
                  <th className="hidden text-right lg:table-cell">{t("txnCount")}</th>
                </tr>
              </AppDataTableHead>
              <AppDataTableBody>
                {report.data.map((r) => (
                  <tr key={r.tankId}>
                    <td className="px-4 py-3">
                      <Link href={`/fuel/tanks/${r.tankId}`} className="font-medium text-blue-700 hover:underline dark:text-blue-300">
                        {r.tankCode}
                      </Link>{" "}
                      {r.tankName}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">{r.branchName}</td>
                    <td className="px-4 py-3">{r.fuelTypeName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtQty(r.receivedQty)}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums xl:table-cell">{fmtMoney(r.receivedCost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtQty(r.dispensedQty)}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums xl:table-cell">{fmtMoney(r.dispensedCost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtQty(r.adjustedQty)}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">{r.txnCount}</td>
                  </tr>
                ))}
                <tr data-tone="total" className="bg-muted font-semibold">
                  <td className="px-4 py-3" colSpan={3}>
                    {t("total")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtQty(report.totals.receivedQty)}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums xl:table-cell">{fmtMoney(report.totals.receivedCost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtQty(report.totals.dispensedQty)}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums xl:table-cell">{fmtMoney(report.totals.dispensedCost)}</td>
                  <td className="px-4 py-3" />
                  <td className="hidden px-4 py-3 lg:table-cell" />
                </tr>
              </AppDataTableBody>
            </AppDataTable>
          )}
        </AppDataTablePanel>
      </ListFrame>
    )
  }

  const report = await getFuelConsumptionReport(prisma, { companyId, roles, query })
  return (
    <ListFrame title={t("reportsTitle")} description={`${t("reportsDesc")} · ${periodNote}`} filters={filters} plainPanel>
      {header}
      <p className="mt-3 text-sm text-foreground">{t("rateHint")}</p>
      {report.truncated && <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-400">{t("truncated")}</p>}
      <AppDataTablePanel className="mt-3">
        {report.data.length === 0 ? (
          <EmptyState icon={BarChart3} title={t("noData")} />
        ) : (
          <AppDataTable>
            <AppDataTableHead>
              <tr>
                <th>{t("consumer")}</th>
                <th className="hidden lg:table-cell">{t("branch")}</th>
                <th className="text-right">{t("dispenseCount")}</th>
                <th className="text-right">{t("usedLiters")}</th>
                <th className="text-right">{t("usedCost")}</th>
                <th className="hidden text-right xl:table-cell">{t("distance")}</th>
                <th className="text-right">{t("kmPerLiter")}</th>
                <th className="hidden text-right xl:table-cell">{t("hours")}</th>
                <th className="text-right">{t("litersPerHour")}</th>
              </tr>
            </AppDataTableHead>
            <AppDataTableBody>
              {report.data.map((r) => (
                <tr key={r.key}>
                  <td className="px-4 py-3">
                    {r.assetId ? (
                      <Link
                        href={`/fuel/transactions?assetId=${r.assetId}`}
                        className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                      >
                        {r.assetCode}
                      </Link>
                    ) : (
                      <span className="text-xs">{t("targetOther")}: </span>
                    )}{" "}
                    {r.name}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">{r.branchName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.dispenseCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtQty(r.liters)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(r.cost)}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums xl:table-cell">{fmtQty(r.odometer?.distance)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtQty(r.odometer?.kmPerLiter)}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums xl:table-cell">{fmtQty(r.hourMeter?.hours)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtQty(r.hourMeter?.litersPerHour)}</td>
                </tr>
              ))}
              <tr data-tone="total" className="bg-muted font-semibold">
                <td className="px-4 py-3">{t("total")}</td>
                <td className="hidden px-4 py-3 lg:table-cell" />
                <td className="px-4 py-3 text-right tabular-nums">{report.totals.dispenseCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtQty(report.totals.liters)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(report.totals.cost)}</td>
                <td className="hidden px-4 py-3 xl:table-cell" />
                <td className="px-4 py-3" />
                <td className="hidden px-4 py-3 xl:table-cell" />
                <td className="px-4 py-3" />
              </tr>
            </AppDataTableBody>
          </AppDataTable>
        )}
      </AppDataTablePanel>
    </ListFrame>
  )
}
