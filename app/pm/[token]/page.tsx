import { getTranslations } from "next-intl/server"
import { NotFoundError } from "@/lib/errors"
import { prisma } from "@/shared/db"
import { getPublicAssetPm, isPmPublicToken } from "@/modules/assets"
import { PmPublicCard } from "@/components/assets/pm-public-form"

export async function generateMetadata() {
  const t = await getTranslations("pmCheck")
  return { title: t("publicTitle") }
}

function Missing({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#d5dee8] px-4 py-10">
      <p className="max-w-md rounded-xl border border-[#94a3b8] bg-[#eef3f8] px-5 py-6 text-sm text-[#334155]">
        {message}
      </p>
    </main>
  )
}

const dueChip: Record<string, string> = {
  overdue: "bg-[#dc2626] text-white",
  due: "bg-[#f59e0b] text-[#1c1917]",
  ok: "bg-[#059669] text-white",
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
    <main className="min-h-screen bg-[#d5dee8] px-4 py-6 sm:py-10">
      <PmPublicCard
        token={token}
        items={items}
        title={t("publicTitle")}
        assetName={assetName}
        assetCode={assetCode}
        statusClass={dueChip[dueStatus] ?? "bg-[#334155] text-white"}
        statusLabel={`${t(`status_${dueStatus}`)}${nextDueDate ? ` · ${nextDueDate}` : ""}`}
      />
    </main>
  )
}
