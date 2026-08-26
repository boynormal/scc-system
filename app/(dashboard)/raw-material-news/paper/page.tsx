import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PaperNewsPageClient } from "@/components/raw-material-news/paper-news-page-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rawMaterialNews")
  return { title: t("paperTitle") }
}

export default async function PaperNewsPage() {
  const t = await getTranslations("rawMaterialNews")
  const tCommon = await getTranslations("common")

  return (
    <PaperNewsPageClient
      title={t("paperTitle")}
      description={t("paperDesc")}
      backLabel={tCommon("back")}
    />
  )
}
