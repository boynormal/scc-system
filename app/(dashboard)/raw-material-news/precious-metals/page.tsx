import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { EmptyCategoryPage } from "@/components/raw-material-news/empty-category-page"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rawMaterialNews")
  return { title: t("preciousMetalsTitle") }
}

export default async function PreciousMetalsNewsPage() {
  const t = await getTranslations("rawMaterialNews")
  const tCommon = await getTranslations("common")

  return (
    <EmptyCategoryPage
      title={t("preciousMetalsTitle")}
      description={t("preciousMetalsDesc")}
      emptyTitle={t("emptyTitle")}
      emptyDescription={t("emptyDesc")}
      backLabel={tCommon("back")}
      icon="Gem"
    />
  )
}
