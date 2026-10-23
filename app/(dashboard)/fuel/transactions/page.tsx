import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Download, Receipt } from "lucide-react"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import {
  FUEL_TXN_TYPES,
  fuelBranchScope,
  listFuelBranches,
  listFuelTanks,
  listFuelTransactions,
} from "@/modules/fuel"
import { AppDataTablePanel } from "@/components/shell/app-data-table"
import { ListFrame } from "@/components/shell/list-frame"
import { EmptyState } from "@/components/ui/empty-state"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"
import { FuelFilters } from "@/components/fuel/fuel-filters"
import { FuelLedgerTable } from "@/components/fuel/fuel-ledger-table"

export async function generateMetadata() {
  const t = await getTranslations("fuel")
  return { title: t("txTitle") }
}

type Query = {
  branchId?: string
  tankId?: string
  type?: string
  assetId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: string
}

export default async function FuelTransactionsPage(props: { searchParams: Promise<Query> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const t = await getTranslations("fuel")
  const sp = await props.searchParams
  const page = parsePage(sp.page)
  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string
  const filter = {
    branchId: sp.branchId,
    tankId: sp.tankId,
    type: sp.type,
    assetId: sp.assetId,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    search: sp.search,
  }

  const [ledger, branches, tanks] = await Promise.all([
    listFuelTransactions(prisma, { companyId, roles, filter, page, pageSize: SSR_PAGE_SIZE }),
    listFuelBranches(prisma, { companyId, roles }),
    listFuelTanks(prisma, { companyId, roles, branchId: sp.branchId }),
  ])
  const query = Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) as Record<string, string>
  const csvHref = `/api/fuel/transactions?${new URLSearchParams({ ...query, format: "csv" }).toString()}`

  return (
    <ListFrame
      title={t("txTitle")}
      description={t("txDesc")}
      actions={
        <a
          href={csvHref}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          <Download className="h-4 w-4" />
          {t("exportCsv")}
        </a>
      }
      filters={
        <Suspense fallback={null}>
          <FuelFilters
            search
            dates
            branches={branches.data}
            tanks={tanks.data.map((x) => ({ id: x.id, name: `${x.code} · ${x.name}` }))}
            txnTypes={FUEL_TXN_TYPES.filter((x) => x !== "TRANSFER_IN" && x !== "TRANSFER_OUT")}
          />
        </Suspense>
      }
      plainPanel
    >
      <AppDataTablePanel>
        {ledger.data.length === 0 ? (
          <EmptyState icon={Receipt} title={t("noTransactions")} />
        ) : (
          <>
            <FuelLedgerTable rows={ledger.data} reversibleBranchIds={fuelBranchScope(roles, "approve")} />
            <ListPagination
              pathname="/fuel/transactions"
              page={page}
              totalPages={Math.max(1, Math.ceil(ledger.total / SSR_PAGE_SIZE))}
              total={ledger.total}
              query={query}
            />
          </>
        )}
      </AppDataTablePanel>
    </ListFrame>
  )
}
