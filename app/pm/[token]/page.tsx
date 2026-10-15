import { getTranslations } from "next-intl/server"
import { NotFoundError } from "@/lib/errors"
import { prisma } from "@/shared/db"
import { getPublicAssetPm, isPmPublicToken } from "@/modules/assets"
import { PmPublicForm } from "@/components/assets/pm-public-form"

export async function generateMetadata() {
  const t = await getTranslations("pmCheck")
  return { title: t("publicTitle") }
}

function Missing({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  )
}

export default async function PublicAssetPmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const t = await getTranslations("pmCheck")
  if (!isPmPublicToken(token)) return <Missing message={t("notFound")} />

  let detail
  try {
    detail = await getPublicAssetPm(prisma, token)
  } catch (error) {
    if (error instanceof NotFoundError) return <Missing message={t("notFound")} />
    throw error
  }

  const { assetName, assetCode, dueStatus, nextDueDate, items } = detail.data

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("publicTitle")}</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">{assetName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{assetCode}</p>
      <p className="mt-3 text-sm text-foreground">
        {t(`status_${dueStatus}`)}
        {nextDueDate ? ` · ${nextDueDate}` : ""}
      </p>
      <div className="mt-6">
        <PmPublicForm token={token} items={items} />
      </div>
    </main>
  )
}
