import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getTranslations } from "next-intl/server"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getDueItem } from "@/modules/due_dates"
import { DueItemForm } from "@/components/due-dates/due-item-form"
import { DuePageHeader } from "@/components/due-dates/due-page-header"

export async function generateMetadata() {
  const t = await getTranslations("dueDates")
  return { title: t("editItem") }
}

export default async function EditDueItemPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) notFound()
  const { id } = await params
  const t = await getTranslations("dueDates")
  let item
  try {
    const result = await getDueItem(prisma, {
      companyId: session.user.companyId,
      roles: session.user.roles as UserRole[],
      id,
    })
    item = result.data
  } catch {
    notFound()
  }

  return (
    <div className="space-y-6">
      <DuePageHeader
        title={t("editItem")}
        description={item.title}
        backHref={`/due-dates/${item.id}`}
        backLabel={item.title}
      />
      <DueItemForm item={item} />
    </div>
  )
}
