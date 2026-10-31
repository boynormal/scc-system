import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { DocumentLibrary } from "../library-view"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("documentCenter")
  return { title: t("recentTitle") }
}

export default function RecentDocumentsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <DocumentLibrary mode="recent" searchParams={props.searchParams} />
}
