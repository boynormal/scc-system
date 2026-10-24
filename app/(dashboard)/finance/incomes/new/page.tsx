import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { IncomeFormPage } from "@/components/finance/income-form-page"
import { canFinance } from "../../finance-access"

export default async function NewIncomePage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "incomes", "create")) redirect("/finance/incomes")
  return <IncomeFormPage />
}
