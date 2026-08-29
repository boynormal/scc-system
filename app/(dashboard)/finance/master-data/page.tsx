import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { FinanceMasterData } from "@/components/finance/finance-master-data"
import { canFinance, getFinancePerms } from "../finance-access"

export default async function FinanceMasterDataPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "expense_masters", "read")) redirect("/")

  return <FinanceMasterData perms={getFinancePerms(roles)} />
}
