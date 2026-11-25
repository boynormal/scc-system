import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { canPurchaseAnywhere } from "@/modules/procurement"
import { PurchaseOrderEditor } from "@/components/procurement/purchase-order-editor"

export async function generateMetadata() {
  const t = await getTranslations("procurement")
  return { title: t("newTitle") }
}

export default async function NewPurchaseOrderPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canPurchaseAnywhere(roles, "create")) redirect("/procurement")

  return (
    <PurchaseOrderEditor
      initial={null}
      perms={{ canCreate: true, canUpdate: true, canDelete: false, canSeeExpense: false }}
    />
  )
}
