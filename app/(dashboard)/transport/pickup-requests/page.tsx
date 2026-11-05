import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { listPickupRequests, type PickupRequestView } from "@/modules/transport"
import { canTransportJobs } from "@/modules/transport/application/transport-job-access"
import { ListFrame } from "@/components/shell/list-frame"
import { PickupRequestsTable } from "@/components/transport/pickup-requests-table"
import { cn } from "@/lib/utils"

const VIEWS: PickupRequestView[] = ["queue", "scheduled", "all"]

export async function generateMetadata() {
  const t = await getTranslations("pickup")
  return { title: t("listTitle") }
}

export default async function PickupRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canTransportJobs(roles, "read")) redirect("/")

  const sp = await searchParams
  const view = VIEWS.includes(sp.view as PickupRequestView) ? (sp.view as PickupRequestView) : "queue"
  const t = await getTranslations("pickup")
  const rows = await listPickupRequests(prisma, {
    companyId: session.user.companyId as string,
    roles,
    view,
  })
  const canWrite = canTransportJobs(roles, "create") || canTransportJobs(roles, "update")

  return (
    <div className="min-w-0 p-4 md:p-6">
      <ListFrame
        title={t("listTitle")}
        description={t("listDesc")}
        plainPanel
        filters={
          <nav className="flex flex-wrap gap-2">
            {VIEWS.map((option) => (
              <Link
                key={option}
                href={`/transport/pickup-requests?view=${option}`}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium",
                  option === view
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-border text-foreground hover:bg-muted"
                )}
              >
                {t(`view_${option}`)}
              </Link>
            ))}
          </nav>
        }
      >
        <PickupRequestsTable rows={rows} canWrite={canWrite} />
      </ListFrame>
    </div>
  )
}
