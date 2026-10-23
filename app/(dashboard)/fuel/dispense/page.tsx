import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Fuel } from "lucide-react"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { canFuelAnywhere, listFuelBranches, listFuelTanks } from "@/modules/fuel"
import { DataPanel } from "@/components/shell/data-panel"
import { PageHeader } from "@/components/shell/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { DispenseForm } from "@/components/fuel/dispense-form"

export async function generateMetadata() {
  const t = await getTranslations("fuel")
  return { title: t("dispenseTitle") }
}

export default async function FuelDispensePage(props: { searchParams: Promise<{ tankId?: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFuelAnywhere(roles, "create")) redirect("/fuel")
  const t = await getTranslations("fuel")
  const companyId = session.user.companyId as string
  const [allTanks, branches] = await Promise.all([
    listFuelTanks(prisma, { companyId, roles, activeOnly: true }),
    listFuelBranches(prisma, { companyId, roles, action: "create" }),
  ])
  const branchIds = new Set(branches.data.map((b) => b.id))
  const tanks = allTanks.data.filter((x) => branchIds.has(x.branchId))
  const usableBranches = branches.data.filter((b) => tanks.some((x) => x.branchId === b.id))

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader title={t("dispenseTitle")} description={t("dispenseDesc")} />
      {tanks.length === 0 ? (
        <DataPanel>
          <EmptyState icon={Fuel} title={t("noActiveTank")} description={t("noTanksHint")} />
        </DataPanel>
      ) : (
        <DispenseForm branches={usableBranches} tanks={tanks} presetTankId={(await props.searchParams).tankId} />
      )}
    </div>
  )
}
