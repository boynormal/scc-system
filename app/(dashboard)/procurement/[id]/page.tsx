import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { getBranchIds, hasPermission, type UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { getSourceFinanceStates } from "@/modules/finance"
import { canPurchaseAnywhere, canPurchaseInBranch, getPurchaseOrder } from "@/modules/procurement"
import { PurchaseOrderEditor } from "@/components/procurement/purchase-order-editor"
import type { PurchaseOrder } from "@/components/procurement/po-client"

export async function generateMetadata() {
  const t = await getTranslations("procurement")
  return { title: t("listTitle") }
}

export default async function PurchaseOrderPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canPurchaseAnywhere(roles, "read")) redirect("/")
  const companyId = session.user.companyId as string
  const { id } = await props.params

  let po
  try {
    po = (await getPurchaseOrder(prisma, { companyId, roles, id })).data
  } catch {
    notFound()
  }

  let finance: PurchaseOrder["finance"] = null
  if (po.status === "RECEIVED") {
    const states = await getSourceFinanceStates(prisma, {
      companyId,
      sourceModule: "PROCUREMENT",
      sourceType: "PURCHASE_ORDER",
      ids: [po.id],
    })
    finance = states.get(po.id) ?? { state: "PENDING" }
  }

  return (
    <PurchaseOrderEditor
      key={`${po.id}:${po.updatedAt}`}
      initial={{ ...po, finance }}
      perms={{
        canCreate: canPurchaseInBranch(roles, po.branchId, "create"),
        canUpdate: canPurchaseInBranch(roles, po.branchId, "update"),
        canDelete: canPurchaseInBranch(roles, po.branchId, "delete"),
        canSeeExpense: getBranchIds(roles).some((b) => hasPermission(roles, b, "expenses", "read")),
      }}
    />
  )
}
