import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { DocumentLibrary } from "../library-view"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("documentCenter")
  return { title: t("favoritesTitle") }
}

export default function FavoriteDocumentsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <DocumentLibrary mode="favorite" searchParams={props.searchParams} />
}
