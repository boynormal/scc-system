import type { PaperMarketSnapshot } from "@/modules/raw_material_news/application/paper-market-types"
import { fetchPaperFx } from "@/modules/raw_material_news/infra/fx-client"
import { fetchSunsirsWastepaper } from "@/modules/raw_material_news/infra/sunsirs-client"
import { fetchFreightosFbx02 } from "@/modules/raw_material_news/infra/freightos-client"

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message
  return fallback
}

export async function getPaperMarketSnapshot(): Promise<PaperMarketSnapshot> {
  const [fxResult, sunsirsResult, freightResult] = await Promise.allSettled([
    fetchPaperFx(),
    fetchSunsirsWastepaper(),
    fetchFreightosFbx02(),
  ])

  const errors: PaperMarketSnapshot["errors"] = {}

  const fx = fxResult.status === "fulfilled" ? fxResult.value : null
  if (fxResult.status === "rejected") {
    errors.fx = errorMessage(fxResult.reason, "ดึงอัตราแลกเปลี่ยนไม่สำเร็จ")
    console.error("[raw-material-news:fx]", fxResult.reason)
  }

  const sunsirs = sunsirsResult.status === "fulfilled" ? sunsirsResult.value : null
  if (sunsirsResult.status === "rejected") {
    errors.sunsirs = errorMessage(sunsirsResult.reason, "ดึงราคา Sunsirs ไม่สำเร็จ")
    console.error("[raw-material-news:sunsirs]", sunsirsResult.reason)
  }

  const freight = freightResult.status === "fulfilled" ? freightResult.value : null
  if (freightResult.status === "rejected") {
    errors.freight = errorMessage(freightResult.reason, "ดึงค่าระวาง Freightos ไม่สำเร็จ")
    console.error("[raw-material-news:freight]", freightResult.reason)
  }

  return {
    fetchedAt: new Date().toISOString(),
    fx,
    sunsirs,
    freight,
    errors,
  }
}
