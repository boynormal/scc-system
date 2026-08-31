import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getTranslations } from "next-intl/server"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getAsset } from "@/modules/assets"
import { AssetForm } from "@/components/assets/asset-form"

export async function generateMetadata() {
  const t = await getTranslations("assets")
  return { title: t("editAsset") }
}

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) notFound()
  const { id } = await params
  const t = await getTranslations("assets")
  let asset
  try {
    const result = await getAsset(prisma, {
      companyId: session.user.companyId,
      roles: session.user.roles as UserRole[],
      id,
    })
    asset = result.data
  } catch {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("editAsset")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{asset.code}</p>
      </div>
      <AssetForm asset={asset} />
    </div>
  )
}
