import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getTranslations } from "next-intl/server"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getDueItem } from "@/modules/due_dates"
import { cn, formatDate, formatDateTime } from "@/lib/utils"
import { DueItemActions } from "@/components/due-dates/due-item-actions"
import { DueStatusBadge } from "@/components/due-dates/due-status-badge"
import { ALERT_VISUAL, dueTone } from "@/components/due-dates/due-alert-theme"
import { DuePageHeader } from "@/components/due-dates/due-page-header"
import { Button } from "@/components/ui/button"
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassTable,
  GlassTableBody,
  GlassTableCell,
  GlassTableHead,
  GlassTableHeader,
  GlassTableRow,
} from "@/components/glass"

export async function generateMetadata() {
  const t = await getTranslations("dueDates")
  return { title: t("detailTitle") }
}

export default async function DueItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const tone = dueTone(item.alertLevel, item.status)
  const visual = ALERT_VISUAL[tone]
  const statusLabel = item.alertLevel ? t(`alert_${item.alertLevel}`) : t(`st_${item.status}`)

  return (
    <div className="space-y-6">
      <DuePageHeader
        title={item.title}
        description={item.branchName}
        backHref="/due-dates"
        backLabel={t("itemsTitle")}
        actions={
          <>
            <DueStatusBadge tone={tone} label={statusLabel} />
            <Link href={`/due-dates/${item.id}/edit`}>
              <Button type="button" variant="outline">
                {t("editItem")}
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <GlassCard className={cn("relative overflow-hidden", visual.surface)}>
          <span className={cn("absolute inset-y-0 left-0 w-1.5", visual.bar)} />
          <p className="pl-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("daysRemaining")}
          </p>
          <p className={cn("mt-2 pl-2 text-4xl font-bold tabular-nums", visual.text)}>{item.daysRemaining}</p>
          <p className="mt-1 pl-2 text-sm text-muted-foreground">{statusLabel}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("dateRange")}</p>
          <p className="mt-2 text-sm font-medium tabular-nums text-foreground">
            {formatDate(item.startDate)} – {formatDate(item.endDate)}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("owner")}</p>
          <p className="mt-2 text-sm font-medium text-foreground">{item.ownerName ?? t("noOwner")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.branchName}</p>
        </GlassCard>
      </div>

      {item.notes && (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>{t("notes")}</GlassCardTitle>
          </GlassCardHeader>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p>
        </GlassCard>
      )}

      <DueItemActions item={item} />

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">{t("renewHistory")}</h2>
        {item.renewals.length === 0 ? (
          <GlassCard>
            <p className="text-sm text-muted-foreground">{t("noRenewals")}</p>
          </GlassCard>
        ) : (
          <GlassTable>
            <GlassTableHeader>
              <tr>
                <GlassTableHead>{t("previousRange")}</GlassTableHead>
                <GlassTableHead>{t("newRange")}</GlassTableHead>
                <GlassTableHead>{t("renewedBy")}</GlassTableHead>
                <GlassTableHead>{t("renewedAt")}</GlassTableHead>
                <GlassTableHead>{t("notes")}</GlassTableHead>
              </tr>
            </GlassTableHeader>
            <GlassTableBody>
              {item.renewals.map((row) => (
                <GlassTableRow key={row.id}>
                  <GlassTableCell className="tabular-nums">
                    {formatDate(row.previousStartDate)} – {formatDate(row.previousEndDate)}
                  </GlassTableCell>
                  <GlassTableCell className="tabular-nums">
                    {formatDate(row.newStartDate)} – {formatDate(row.newEndDate)}
                  </GlassTableCell>
                  <GlassTableCell>{row.renewedByName}</GlassTableCell>
                  <GlassTableCell className="tabular-nums">{formatDateTime(row.renewedAt)}</GlassTableCell>
                  <GlassTableCell>{row.notes ?? "—"}</GlassTableCell>
                </GlassTableRow>
              ))}
            </GlassTableBody>
          </GlassTable>
        )}
      </section>
    </div>
  )
}
