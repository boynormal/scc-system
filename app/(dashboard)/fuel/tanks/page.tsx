import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Fuel } from "lucide-react"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { canFuelAnywhere, listFuelBranches, listFuelTanks, listFuelTypes } from "@/modules/fuel"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { ListFrame } from "@/components/shell/list-frame"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { FuelFilters } from "@/components/fuel/fuel-filters"
import { fmtCost, fmtMoney, fmtQty } from "@/components/fuel/fuel-format"
import { TankCreateButton, TankRowActions } from "@/components/fuel/tank-buttons"
import { TankLevel } from "@/components/fuel/tank-level"

export async function generateMetadata() {
  const t = await getTranslations("fuel")
  return { title: t("tanksTitle") }
}

export default async function FuelTanksPage(props: {
  searchParams: Promise<{ branchId?: string; fuelTypeId?: string; search?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const t = await getTranslations("fuel")
  const searchParams = await props.searchParams
  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string

  const canCreate = canFuelAnywhere(roles, "create")
  const [tanks, branches, createBranches, fuelTypes] = await Promise.all([
    listFuelTanks(prisma, {
      companyId,
      roles,
      branchId: searchParams.branchId,
      fuelTypeId: searchParams.fuelTypeId,
      search: searchParams.search,
    }),
    listFuelBranches(prisma, { companyId, roles }),
    canCreate ? listFuelBranches(prisma, { companyId, roles, action: "create" }) : Promise.resolve({ data: [] }),
    listFuelTypes(prisma, { companyId, roles }),
  ])
  const activeTypes = fuelTypes.data.filter((f) => f.isActive)
  const canUpdate = canFuelAnywhere(roles, "update")
  const canDelete = canFuelAnywhere(roles, "delete")

  return (
    <ListFrame
      title={t("tanksTitle")}
      description={t("tanksDesc")}
      actions={canCreate ? <TankCreateButton branches={createBranches.data} fuelTypes={activeTypes} /> : null}
      filters={
        <Suspense fallback={null}>
          <FuelFilters search branches={branches.data} fuelTypes={fuelTypes.data} />
        </Suspense>
      }
      plainPanel
    >
      <AppDataTablePanel>
        {tanks.data.length === 0 ? (
          <EmptyState icon={Fuel} title={t("noTanks")} description={t("noTanksHint")} />
        ) : (
          <AppDataTable>
            <AppDataTableHead>
              <tr>
                <th>{t("tankCode")}</th>
                <th>{t("tankName")}</th>
                <th className="hidden xl:table-cell">{t("branch")}</th>
                <th>{t("fuelType")}</th>
                <th className="text-right">{t("currentQty")}</th>
                <th className="w-40">{t("fill")}</th>
                <th className="hidden text-right xl:table-cell">{t("avgCost")}</th>
                <th className="hidden text-right xl:table-cell">{t("stockValue")}</th>
                <th>{t("status")}</th>
                <th className="text-right">{t("manage")}</th>
              </tr>
            </AppDataTableHead>
            <AppDataTableBody>
              {tanks.data.map((tank) => (
                <tr key={tank.id}>
                  <td className="px-4 py-3 font-semibold">{tank.code}</td>
                  <td className="px-4 py-3">{tank.name}</td>
                  <td className="hidden px-4 py-3 xl:table-cell">{tank.branchName}</td>
                  <td className="px-4 py-3">{tank.fuelTypeName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtQty(tank.currentQty)} / {fmtQty(tank.capacity)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TankLevel percent={tank.fillPercent} low={tank.isLow} />
                      <span className="w-12 text-right text-xs tabular-nums">{tank.fillPercent}%</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums xl:table-cell">{fmtCost(tank.avgCost)}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums xl:table-cell">{fmtMoney(tank.stockValue)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {tank.isActive ? (
                        <Badge variant="success">{t("active")}</Badge>
                      ) : (
                        <Badge>{t("inactive")}</Badge>
                      )}
                      {tank.isActive && tank.isLow && <Badge variant="warning">{t("lowBadge")}</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TankRowActions
                      tank={tank}
                      branches={createBranches.data.length ? createBranches.data : branches.data}
                      fuelTypes={fuelTypes.data.filter((f) => f.isActive || f.id === tank.fuelTypeId)}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                    />
                  </td>
                </tr>
              ))}
            </AppDataTableBody>
          </AppDataTable>
        )}
      </AppDataTablePanel>
    </ListFrame>
  )
}
