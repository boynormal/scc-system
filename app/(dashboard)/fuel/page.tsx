import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Fuel } from "lucide-react"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { canFuelAnywhere, getFuelMovementReport, getFuelStockReport } from "@/modules/fuel"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { DataPanel } from "@/components/shell/data-panel"
import { PageHeader } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { fmtCost, fmtMoney, fmtQty } from "@/components/fuel/fuel-format"
import { TankLevel } from "@/components/fuel/tank-level"

export async function generateMetadata() {
  const t = await getTranslations("fuel")
  return { title: t("overviewTitle") }
}

function bangkokMonthStart(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return `${now.toISOString().slice(0, 7)}-01`
}

export default async function FuelOverviewPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const t = await getTranslations("fuel")
  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string
  const [stock, month] = await Promise.all([
    getFuelStockReport(prisma, { companyId, roles }),
    getFuelMovementReport(prisma, { companyId, roles, query: { dateFrom: bangkokMonthStart() } }),
  ])
  const canCreate = canFuelAnywhere(roles, "create")
  const activeTanks = stock.data.tanks.filter((x) => x.isActive)

  const kpis = [
    { label: t("totalStock"), value: `${fmtQty(stock.data.totals.currentQty)} ${t("liters")}` },
    { label: t("totalValue"), value: `${fmtMoney(stock.data.totals.stockValue)} ${t("baht")}` },
    { label: t("lowTanks"), value: String(stock.data.totals.lowCount), warn: stock.data.totals.lowCount > 0 },
    { label: t("monthReceived"), value: `${fmtQty(month.totals.receivedQty)} ${t("liters")}` },
    { label: t("monthDispensed"), value: `${fmtQty(month.totals.dispensedQty)} ${t("liters")}` },
  ]

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader
        title={t("overviewTitle")}
        description={t("overviewDesc")}
        actions={
          canCreate ? (
            <>
              <Link href="/fuel/dispense">
                <Button type="button">{t("tabDispense")}</Button>
              </Link>
              <Link href="/fuel/receive">
                <Button type="button" variant="outline">
                  {t("tabReceive")}
                </Button>
              </Link>
            </>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <DataPanel key={k.label} padding="sm">
            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
            <p
              className={`mt-1 text-xl font-bold tabular-nums ${k.warn ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}
            >
              {k.value}
            </p>
          </DataPanel>
        ))}
      </div>

      {activeTanks.length === 0 ? (
        <DataPanel>
          <EmptyState
            icon={Fuel}
            title={t("noTanks")}
            description={t("noTanksHint")}
            action={
              <Link href="/fuel/tanks">
                <Button type="button">{t("goTanks")}</Button>
              </Link>
            }
          />
        </DataPanel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {activeTanks.map((tank) => (
            <Link key={tank.id} href={`/fuel/tanks/${tank.id}`} className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              <DataPanel padding="sm" className="h-full transition-shadow hover:shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {tank.code} · {tank.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tank.branchName} · {tank.fuelTypeName}
                    </p>
                  </div>
                  {tank.isLow && <Badge variant="warning">{t("lowBadge")}</Badge>}
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
                  {fmtQty(tank.currentQty)} <span className="text-sm font-medium">{tank.unit}</span>
                </p>
                <p className="text-xs text-muted-foreground">{t("capacityOf", { capacity: fmtQty(tank.capacity) })}</p>
                <div className="mt-2 flex items-center gap-2">
                  <TankLevel percent={tank.fillPercent} low={tank.isLow} />
                  <span className="w-12 text-right text-xs tabular-nums">{tank.fillPercent}%</span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-foreground">
                  <span>
                    {t("avgCost")}: {fmtCost(tank.avgCost)}
                  </span>
                  <span>
                    {t("stockValue")}: {fmtMoney(tank.stockValue)}
                  </span>
                </div>
              </DataPanel>
            </Link>
          ))}
        </div>
      )}

      {stock.data.summary.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-foreground">{t("summaryByBranch")}</h2>
          <AppDataTablePanel>
            <AppDataTable>
              <AppDataTableHead>
                <tr>
                  <th>{t("branch")}</th>
                  <th>{t("fuelType")}</th>
                  <th className="text-right">{t("tankCount")}</th>
                  <th className="text-right">{t("capacity")}</th>
                  <th className="text-right">{t("currentQty")}</th>
                  <th className="text-right">{t("stockValue")}</th>
                </tr>
              </AppDataTableHead>
              <AppDataTableBody>
                {stock.data.summary.map((row) => (
                  <tr key={`${row.branchId}-${row.fuelTypeName}`}>
                    <td className="px-4 py-3">{row.branchName}</td>
                    <td className="px-4 py-3">{row.fuelTypeName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.tankCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtQty(row.capacity)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtQty(row.currentQty)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(row.stockValue)}</td>
                  </tr>
                ))}
              </AppDataTableBody>
            </AppDataTable>
          </AppDataTablePanel>
        </>
      )}
    </div>
  )
}
