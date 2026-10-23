import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Fuel } from "lucide-react"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { canFuelAnywhere, getFuelOptions, listFuelBranches } from "@/modules/fuel"
import { DataPanel } from "@/components/shell/data-panel"
import { PageHeader } from "@/components/shell/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { ReceiveForm } from "@/components/fuel/receive-form"

export async function generateMetadata() {
  const t = await getTranslations("fuel")
  return { title: t("receiveTitle") }
}

export default async function FuelReceivePage(props: { searchParams: Promise<{ tankId?: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFuelAnywhere(roles, "create")) redirect("/fuel")
  const t = await getTranslations("fuel")
  const companyId = session.user.companyId as string
  const [options, branches] = await Promise.all([
    getFuelOptions(prisma, { companyId, roles }),
    listFuelBranches(prisma, { companyId, roles, action: "create" }),
  ])
  const branchIds = new Set(branches.data.map((b) => b.id))
  const tanks = options.data.tanks.filter((x) => branchIds.has(x.branchId))
  const usableBranches = branches.data.filter((b) => tanks.some((x) => x.branchId === b.id))

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader title={t("receiveTitle")} description={t("receiveDesc")} />
      {tanks.length === 0 ? (
        <DataPanel>
          <EmptyState icon={Fuel} title={t("noActiveTank")} description={t("noTanksHint")} />
        </DataPanel>
      ) : (
        <ReceiveForm
          branches={usableBranches}
          tanks={tanks}
          suppliers={options.data.suppliers}
          presetTankId={(await props.searchParams).tankId}
        />
      )}
    </div>
  )
}
