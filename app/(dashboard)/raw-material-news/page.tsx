import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { RMN_CATEGORIES } from "@/components/raw-material-news/categories"
import { RawMaterialNewsHub } from "@/components/raw-material-news/hub-page"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rawMaterialNews")
  return { title: t("hubTitle") }
}

export default async function RawMaterialNewsPage() {
  const t = await getTranslations("rawMaterialNews")

  return (
    <RawMaterialNewsHub
      title={t("hubTitle")}
      description={t("hubDesc")}
      categories={RMN_CATEGORIES.map((category) => ({
        href: category.href,
        title: t(category.titleKey),
        description: t(category.descKey),
        iconKey: category.icon,
      }))}
    />
  )
}
