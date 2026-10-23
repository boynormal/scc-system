import Link from "next/link"
import { getTranslations } from "next-intl/server"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { canFuelAnywhere, fuelBranchScope, getFuelConsumptionReport, listFuelTransactions } from "@/modules/fuel"
import { GlassCard, GlassCardHeader, GlassCardTitle } from "@/components/glass"
import { fmtMoney, fmtQty } from "./fuel-format"
import { FuelLedgerTable } from "./fuel-ledger-table"

const RECENT_LIMIT = 10

/** Recent dispenses to one asset; renders nothing without fuel read permission. */
export async function AssetFuelHistory({
  db,
  companyId,
  roles,
  assetId,
}: {
  db: PrismaClient
  companyId: string
  roles: UserRole[]
  assetId: string
}) {
  if (!canFuelAnywhere(roles, "read")) return null
  const t = await getTranslations("fuel")
  const [recent, usage] = await Promise.all([
    listFuelTransactions(db, { companyId, roles, filter: { assetId }, page: 1, pageSize: RECENT_LIMIT }),
    getFuelConsumptionReport(db, { companyId, roles, query: { assetId } }),
  ])
  const row = usage.data.find((r) => r.assetId === assetId)

  return (
    <GlassCard>
      <GlassCardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <GlassCardTitle>{t("assetFuelHistory")}</GlassCardTitle>
          {recent.total > 0 && (
            <Link href={`/fuel/transactions?assetId=${assetId}`} className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">
              {t("viewAll")} ({recent.total})
            </Link>
          )}
        </div>
      </GlassCardHeader>
      {row && (
        <p className="mb-3 text-sm text-foreground">
          {t("assetFuelSummary", { liters: fmtQty(row.liters), cost: fmtMoney(row.cost), count: row.dispenseCount })}
          {row.odometer?.kmPerLiter != null && ` · ${fmtQty(row.odometer.kmPerLiter)} ${t("kmPerLiter")}`}
          {row.hourMeter?.litersPerHour != null && ` · ${fmtQty(row.hourMeter.litersPerHour)} ${t("litersPerHour")}`}
        </p>
      )}
      {recent.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noTransactions")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <FuelLedgerTable
            rows={recent.data}
            showBalance={false}
            sticky={false}
            reversibleBranchIds={fuelBranchScope(roles, "approve")}
          />
        </div>
      )}
    </GlassCard>
  )
}
