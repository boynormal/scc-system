import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { DocumentLibrary } from "./library-view"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("documentCenter")
  return { title: t("libraryTitle") }
}

export default function DocumentCenterPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <DocumentLibrary mode="all" searchParams={props.searchParams} />
}
