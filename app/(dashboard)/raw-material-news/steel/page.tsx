import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { EmptyCategoryPage } from "@/components/raw-material-news/empty-category-page"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rawMaterialNews")
  return { title: t("steelTitle") }
}

export default async function SteelNewsPage() {
  const t = await getTranslations("rawMaterialNews")
  const tCommon = await getTranslations("common")

  return (
    <EmptyCategoryPage
      title={t("steelTitle")}
      description={t("steelDesc")}
      emptyTitle={t("emptyTitle")}
      emptyDescription={t("emptyDesc")}
      backLabel={tCommon("back")}
      icon="Hammer"
    />
  )
}
