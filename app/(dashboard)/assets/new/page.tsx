import { getTranslations } from "next-intl/server"
import { AssetForm } from "@/components/assets/asset-form"

export async function generateMetadata() {
  const t = await getTranslations("assets")
  return { title: t("newAsset") }
}

export default async function NewAssetPage() {
  const t = await getTranslations("assets")
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("newAsset")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("codeHint")}</p>
      </div>
      <AssetForm />
    </div>
  )
}
