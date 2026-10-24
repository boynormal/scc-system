import {
  getBranchIds,
  hasPermission,
  isAdminInAnyBranch,
  type Action,
  type Resource,
  type UserRole,
} from "@/lib/permissions"
import type { FinancePerms } from "@/components/finance/expense-types"

export function canFinance(roles: UserRole[], resource: Resource, action: Action): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, resource, action))
  )
}

export function getFinancePerms(roles: UserRole[]): FinancePerms {
  return {
    canCreate: canFinance(roles, "expenses", "create"),
    canUpdate: canFinance(roles, "expenses", "update"),
    canDelete: canFinance(roles, "expenses", "delete"),
    canApprove: canFinance(roles, "expenses", "approve"),
    canManageMasters: canFinance(roles, "expense_masters", "update"),
  }
}

export function getIncomePerms(roles: UserRole[]): FinancePerms {
  return {
    canCreate: canFinance(roles, "incomes", "create"),
    canUpdate: canFinance(roles, "incomes", "update"),
    canDelete: canFinance(roles, "incomes", "delete"),
    canApprove: canFinance(roles, "incomes", "approve"),
    canManageMasters: canFinance(roles, "expense_masters", "update"),
  }
}
