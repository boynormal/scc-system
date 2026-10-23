import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { canFuelAnywhere, listFuelTypes } from "@/modules/fuel"
import { FuelTypeManager } from "@/components/fuel/fuel-type-manager"

export async function generateMetadata() {
  const t = await getTranslations("fuel")
  return { title: t("typesTitle") }
}

export default async function FuelTypesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  const { data } = await listFuelTypes(prisma, { companyId: session.user.companyId as string, roles })
  return (
    <FuelTypeManager
      rows={data}
      canCreate={canFuelAnywhere(roles, "create")}
      canUpdate={canFuelAnywhere(roles, "update")}
      canDelete={canFuelAnywhere(roles, "delete")}
    />
  )
}
