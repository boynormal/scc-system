import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Receipt } from "lucide-react"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { canFuelInBranch, getFuelTank, listFuelTransactions } from "@/modules/fuel"
import { AppDataTablePanel } from "@/components/shell/app-data-table"
import { DataPanel } from "@/components/shell/data-panel"
import { PageHeader } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"
import { AdjustTankButton } from "@/components/fuel/fuel-action-buttons"
import { fmtCost, fmtMoney, fmtQty } from "@/components/fuel/fuel-format"
import { FuelLedgerTable } from "@/components/fuel/fuel-ledger-table"
import { TankLevel } from "@/components/fuel/tank-level"

export async function generateMetadata() {
  const t = await getTranslations("fuel")
  return { title: t("tankDetail") }
}

export default async function FuelTankDetailPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const { id } = await props.params
  const page = parsePage((await props.searchParams).page)
  const t = await getTranslations("fuel")
  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string

  let tank
  try {
    tank = (await getFuelTank(prisma, { companyId, roles, id })).data
  } catch {
    notFound()
  }
  const ledger = await listFuelTransactions(prisma, {
    companyId,
    roles,
    filter: { tankId: tank.id },
    page,
    pageSize: SSR_PAGE_SIZE,
  })
  const canCreate = tank.isActive && canFuelInBranch(roles, tank.branchId, "create")
  const canApprove = canFuelInBranch(roles, tank.branchId, "approve")

  const stats = [
    { label: t("currentQty"), value: `${fmtQty(tank.currentQty)} ${tank.unit}` },
    { label: t("capacity"), value: fmtQty(tank.capacity) },
    { label: t("minLevel"), value: fmtQty(tank.minLevel) },
    { label: t("avgCost"), value: fmtCost(tank.avgCost) },
    { label: t("stockValue"), value: `${fmtMoney(tank.stockValue)} ${t("baht")}` },
  ]

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <Link href="/fuel/tanks" className="text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-300">
          ← {t("tanksTitle")}
        </Link>
      </div>
      <PageHeader
        title={`${tank.code} · ${tank.name}`}
        description={`${tank.branchName} · ${tank.fuelTypeName}`}
        actions={
          <>
            {canCreate && (
              <>
                <Link href={`/fuel/dispense?tankId=${tank.id}`}>
                  <Button type="button">{t("tabDispense")}</Button>
                </Link>
                <Link href={`/fuel/receive?tankId=${tank.id}`}>
                  <Button type="button" variant="outline">
                    {t("tabReceive")}
                  </Button>
                </Link>
              </>
            )}
            {canApprove && <AdjustTankButton tankId={tank.id} currentQty={tank.currentQty} unit={tank.unit} />}
          </>
        }
      />

      <DataPanel padding="sm">
        <div className="mb-3 flex items-center gap-3">
          <TankLevel percent={tank.fillPercent} low={tank.isLow} className="h-3" />
          <span className="w-14 text-right text-sm font-semibold tabular-nums">{tank.fillPercent}%</span>
          {!tank.isActive && <Badge>{t("inactiveBadge")}</Badge>}
          {tank.isActive && tank.isLow && <Badge variant="warning">{t("lowBadge")}</Badge>}
        </div>
        <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-xs font-medium text-muted-foreground">{s.label}</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{s.value}</dd>
            </div>
          ))}
        </dl>
      </DataPanel>

      <h2 className="text-base font-semibold text-foreground">{t("ledgerTitle")}</h2>
      <AppDataTablePanel>
        {ledger.data.length === 0 ? (
          <EmptyState icon={Receipt} title={t("noTransactions")} />
        ) : (
          <>
            <FuelLedgerTable
              rows={ledger.data}
              showTank={false}
              reversibleBranchIds={canApprove ? [tank.branchId] : []}
            />
            <ListPagination
              pathname={`/fuel/tanks/${tank.id}`}
              page={page}
              totalPages={Math.max(1, Math.ceil(ledger.total / SSR_PAGE_SIZE))}
              total={ledger.total}
            />
          </>
        )}
      </AppDataTablePanel>
    </div>
  )
}
