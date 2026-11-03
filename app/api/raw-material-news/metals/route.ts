import { withAuth } from "@/lib/api-handler"
import { getMetalsQuoteSnapshot } from "@/modules/raw_material_news"

export const maxDuration = 60

export const GET = withAuth(async () => {
  const data = await getMetalsQuoteSnapshot()
  return Response.json(data)
})
