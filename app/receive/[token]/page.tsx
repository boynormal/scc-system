import { getTranslations } from "next-intl/server"
import { NotFoundError } from "@/lib/errors"
import { prisma } from "@/shared/db"
import { getPublicPickupPage, isPickupPublicToken } from "@/modules/transport"
import { PickupPublicForm } from "@/components/transport/pickup-public-form"

export const dynamic = "force-dynamic"

export async function generateMetadata() {
  const t = await getTranslations("pickup")
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

export default async function PublicPickupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const t = await getTranslations("pickup")
  if (!isPickupPublicToken(token)) return <Missing message={t("notFound")} />

  let page
  try {
    page = await getPublicPickupPage(prisma, token)
  } catch (error) {
    if (error instanceof NotFoundError) return <Missing message={t("notFound")} />
    throw error
  }

  return (
    <main className="min-h-screen bg-[#dbeafe] px-3 py-4 sm:px-4 sm:py-8">
      <div className="mx-auto max-w-md">
        <PickupPublicForm
          token={token}
          customerName={page.customerName}
          cargoTypes={page.cargoTypes}
          units={page.units}
          requests={page.requests}
        />
      </div>
    </main>
  )
}
