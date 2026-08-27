"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DuePageHeader } from "./due-page-header"
import { DueItemList, type DueSummaryCounts } from "./due-item-list"

export function DueDatesListView({
  counts,
  currentUserId,
}: {
  counts: DueSummaryCounts
  currentUserId: string
}) {
  const t = useTranslations("dueDates")
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-6">
      <DuePageHeader
        title={t("itemsTitle")}
        description={t("itemsDesc")}
        actions={
          <Button
            type="button"
            icon={<Plus className="h-4 w-4" />}
            className="rounded-xl bg-violet-600 shadow-md shadow-violet-600/20 hover:bg-violet-700"
            onClick={() => setCreateOpen(true)}
          >
            {t("newItem")}
          </Button>
        }
      />
      <DueItemList
        counts={counts}
        currentUserId={currentUserId}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
      />
    </div>
  )
}
