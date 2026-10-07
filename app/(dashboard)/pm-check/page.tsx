import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

export async function generateMetadata() {
  const t = await getTranslations("pmCheck")
  return { title: t("title") }
}

export default async function PmCheckPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const t = await getTranslations("pmCheck")

  return (
    <div className="min-w-0 space-y-2 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("empty")}</p>
    </div>
  )
}
