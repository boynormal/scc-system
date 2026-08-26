"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlassCard, GlassCardHeader, GlassCardTitle } from "@/components/glass"
import type { DueItemDto } from "./due-item-types"
import { DueRenewDialog } from "./due-renew-dialog"
import { DueOpenToggle } from "./due-open-toggle"

export function DueItemActions({ item }: { item: DueItemDto }) {
  const t = useTranslations("dueDates")
  const router = useRouter()
  const [renewOpen, setRenewOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t("actionsTitle")}</GlassCardTitle>
        </GlassCardHeader>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          {item.status === "open" && (
            <Button
              type="button"
              variant="outline"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => setRenewOpen(true)}
            >
              {t("renew")}
            </Button>
          )}
          <DueOpenToggle
            item={item}
            onUpdated={() => router.refresh()}
            onFailed={setError}
          />
        </div>
      </GlassCard>
      <DueRenewDialog
        item={item}
        open={renewOpen}
        onOpenChange={setRenewOpen}
        onRenewed={() => router.refresh()}
      />
    </>
  )
}
