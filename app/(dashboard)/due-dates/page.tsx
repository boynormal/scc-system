import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getDueSummary } from "@/modules/due_dates"
import { DueDatesListView } from "@/components/due-dates/due-dates-list-view"

export async function generateMetadata() {
  const t = await getTranslations("dueDates")
  return { title: t("itemsTitle") }
}

export default async function DueDatesListPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const summary = await getDueSummary(prisma, {
    companyId: session.user.companyId,
    roles: session.user.roles as UserRole[],
  })

  return <DueDatesListView counts={summary.counts} currentUserId={session.user.id} />
}
