"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { followTabHref, useNavPending } from "@/components/shell/nav-pending"
import { isPlainLeftClick } from "@/components/shell/nav-pending-utils"
import { SubTabs } from "@/components/shell/sub-tabs"
import { SLIDING_PILL_BASE, SLIDING_PILL_MOTION, useSlidingPill } from "@/components/shell/use-sliding-pill"
import { compareBranchTabName } from "@/modules/hr/application/branch-tab-order"

const TABS = ["day", "badges", "devices"] as const
type Tab = (typeof TABS)[number]

export function AttendanceChrome({
  branches,
  branchId,
  tab,
  counts,
}: {
  branches: { id: string; code: string; name: string }[]
  branchId: string
  tab: Tab
  counts: Record<string, number>
}) {
  const t = useTranslations("attendance")
  if (branches.length <= 1) return null

  return (
    <SubTabs
          aria-label={t("branch")}
          activeKey={branchId}
          items={[...branches]
            .sort((a, b) => compareBranchTabName(a.name, b.name))
            .map((branch) => ({
              key: branch.id,
              label: branch.name,
              count: counts[branch.id] ?? 0,
              href: `/hr/attendance?${new URLSearchParams({ branchId: branch.id, tab })}`,
            }))}
        />
  )
}

export function AttendanceSectionTabs({ branchId, tab }: { branchId: string; tab: Tab }) {
  const t = useTranslations("attendance")
  const nav = useNavPending()
  const { rootRef, setItemRef, shownKey, select, pillStyle, ready } = useSlidingPill(true, tab)

  return (
    <nav
      ref={rootRef}
      className="relative inline-flex shrink-0 gap-1 rounded-lg border border-border bg-muted p-1"
      aria-label={t("title")}
    >
      {pillStyle && (
        <span
          aria-hidden
          className={cn(SLIDING_PILL_BASE, "rounded-md bg-blue-600 shadow-sm", ready && SLIDING_PILL_MOTION)}
          style={pillStyle}
        />
      )}
      {TABS.map((key) => {
        const active = key === shownKey
        const href = `/hr/attendance?${new URLSearchParams({ branchId, tab: key })}`
        return (
          <Link
            key={key}
            ref={setItemRef(key)}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (!nav) {
                if (isPlainLeftClick(event)) select(key)
                return
              }
              followTabHref(event, {
                href,
                scope: "section",
                nav,
                select: () => select(key),
              })
            }}
            className={cn(
              "relative z-10 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-300",
              active ? "text-white" : "text-foreground hover:bg-background"
            )}
          >
            {t(`tabs.${key}`)}
          </Link>
        )
      })}
    </nav>
  )
}
