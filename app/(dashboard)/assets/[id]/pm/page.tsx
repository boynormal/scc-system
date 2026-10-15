import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import QRCode from "qrcode"
import { ArrowLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getLocale, getTranslations } from "next-intl/server"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { NotFoundError } from "@/lib/errors"
import { getAssetPm } from "@/modules/assets"
import { PmPlanForm } from "@/components/assets/pm-plan-form"
import { PmQrActions } from "@/components/assets/pm-qr-actions"
import { GlassCard, GlassCardHeader, GlassCardTitle } from "@/components/glass"

async function requestOrigin() {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const proto = headerList.get("x-forwarded-proto") ?? "https"
  return (process.env.NEXTAUTH_URL ?? (host ? `${proto}://${host}` : "")).replace(/\/$/, "")
}

function formatStamp(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso))
}

export async function generateMetadata() {
  const t = await getTranslations("pmCheck")
  return { title: t("title") }
}

export default async function AssetPmPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { id } = await params
  const t = await getTranslations("pmCheck")
  const locale = await getLocale()
  const roles = session.user.roles as UserRole[]
  const canUpdate =
    isAdminInAnyBranch(roles) || getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", "update"))

  let detail
  try {
    detail = await getAssetPm(prisma, {
      companyId: session.user.companyId as string,
      roles,
      assetId: id,
    })
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const { asset, plan } = detail.data
  const origin = await requestOrigin()
  const qrDataUrl =
    plan && origin ? await QRCode.toDataURL(`${origin}${plan.publicPath}`, { margin: 1, width: 220 }) : null

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/assets?tab=pm-check"
          aria-label={t("backToList")}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">{asset.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{asset.code}</p>
      </div>

      {!plan && !canUpdate && <p className="text-sm text-muted-foreground">{t("noPlan")}</p>}

      {plan && (
        <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle>{t("qrTitle")}</GlassCardTitle>
            </GlassCardHeader>
            <p className="text-sm text-muted-foreground">{t("qrHint")}</p>
            <div className="mt-4 space-y-4">
              <PmQrActions
                assetId={asset.id}
                assetName={asset.name}
                branchName={asset.branch.name}
                typeLabel={asset.type.name}
                dataUrl={qrDataUrl}
                canRotate={canUpdate}
              />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("colStatus")}</dt>
                  <dd className="mt-1 text-foreground">{t(`status_${plan.dueStatus}`)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("nextDue")}</dt>
                  <dd className="mt-1 text-foreground">{plan.nextDueDate ?? "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("lastCheck")}</dt>
                  <dd className="mt-1 text-foreground">
                    {plan.lastRecordedAt ? formatStamp(plan.lastRecordedAt, locale) : t("neverChecked")}
                  </dd>
                </div>
              </dl>
              <Link
                href={plan.publicPath}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t("viewForm")}
              </Link>
            </div>
          </GlassCard>

          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle>{t("items")}</GlassCardTitle>
            </GlassCardHeader>
            {canUpdate ? (
              <PmPlanForm
                assetId={asset.id}
                intervalDays={plan.intervalDays}
                isActive={plan.isActive}
                items={plan.items}
              />
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
                {plan.items.map((item) => (
                  <li key={item.id}>{item.name}</li>
                ))}
              </ol>
            )}
          </GlassCard>
        </div>
      )}

      {!plan && canUpdate && (
        <GlassCard className="max-w-xl">
          <GlassCardHeader>
            <GlassCardTitle>{t("items")}</GlassCardTitle>
          </GlassCardHeader>
          <PmPlanForm assetId={asset.id} intervalDays={30} isActive items={[]} />
        </GlassCard>
      )}

      {plan && (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>{t("history")}</GlassCardTitle>
          </GlassCardHeader>
          {plan.rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
          ) : (
            <div className="space-y-4">
              {plan.rounds.map((round) => (
                <div key={round.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-foreground">{formatStamp(round.recordedAt, locale)}</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {round.results.map((result) => (
                      <li key={`${round.id}-${result.sequence}`}>
                        {result.sequence}. {result.itemName} —{" "}
                        {result.status === "pass" || result.status === "fail" || result.status === "na"
                          ? t(result.status)
                          : result.status}
                        {result.remark ? ` (${result.remark})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  )
}
