import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getTranslations } from "next-intl/server"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { getAsset } from "@/modules/assets"
import { AssetDeleteButton } from "@/components/assets/asset-delete-button"
import { Button } from "@/components/ui/button"
import { GlassCard, GlassCardHeader, GlassCardTitle } from "@/components/glass"

export async function generateMetadata() {
  const t = await getTranslations("assets")
  return { title: t("detailTitle") }
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) notFound()
  const { id } = await params
  const t = await getTranslations("assets")
  const roles = session.user.roles as UserRole[]
  let asset
  try {
    const result = await getAsset(prisma, {
      companyId: session.user.companyId,
      roles,
      id,
    })
    asset = result.data
  } catch {
    notFound()
  }

  const canUpdate =
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", "update"))
  const canDelete =
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", "delete"))

  const rows: { label: string; value: string }[] = [
    { label: t("code"), value: asset.code },
    { label: t("name"), value: asset.name },
    { label: t("type"), value: t(`type_${asset.type}`) },
    { label: t("ownership"), value: t(`own_${asset.ownership}`) },
    { label: t("status"), value: t(`st_${asset.status}`) },
    { label: t("branch"), value: asset.branchName },
    { label: t("serialNumber"), value: asset.serialNumber ?? "—" },
    { label: t("locationDetail"), value: asset.locationDetail ?? "—" },
    { label: t("supplier"), value: asset.supplierName ?? t("supplierNone") },
    { label: t("acquiredAt"), value: asset.acquiredAt ?? "—" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/assets" className="text-sm text-blue-700 hover:text-blue-900">
            ← {t("title")}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{asset.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{asset.code}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && (
            <Link href={`/assets/${asset.id}/edit`}>
              <Button type="button" variant="outline">
                {t("editAsset")}
              </Button>
            </Link>
          )}
          {canDelete && <AssetDeleteButton id={asset.id} />}
        </div>
      </div>

      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t("detailTitle")}</GlassCardTitle>
        </GlassCardHeader>
        <dl className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</dt>
              <dd className="mt-1 text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </GlassCard>
    </div>
  )
}
