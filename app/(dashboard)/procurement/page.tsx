import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { canPurchaseAnywhere } from "@/modules/procurement"
import { PurchaseOrderList } from "@/components/procurement/purchase-order-list"

export async function generateMetadata() {
  const t = await getTranslations("procurement")
  return { title: t("listTitle") }
}

export default async function ProcurementPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canPurchaseAnywhere(roles, "read")) redirect("/")

  return (
    <Suspense fallback={null}>
      <PurchaseOrderList canCreate={canPurchaseAnywhere(roles, "create")} />
    </Suspense>
  )
}
