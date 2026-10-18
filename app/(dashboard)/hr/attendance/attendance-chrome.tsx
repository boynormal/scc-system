"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { Select } from "@/components/ui/select"

const TABS = ["day", "badges", "devices"] as const
type Tab = (typeof TABS)[number]

export function AttendanceChrome({
  branches,
  branchId,
  tab,
}: {
  branches: { id: string; code: string; name: string }[]
  branchId: string
  tab: Tab
}) {
  const t = useTranslations("attendance")
  const router = useRouter()

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border">
      <label htmlFor="attendance-branch" className="sr-only">
        {t("branch")}
      </label>
      <div className="w-[22rem] max-w-full shrink-0">
        <Select
          id="attendance-branch"
          value={branchId}
          onChange={(e) => {
            router.push(`/hr/attendance?${new URLSearchParams({ branchId: e.target.value, tab })}`)
          }}
          className="h-9 border-slate-300 bg-white font-medium text-foreground shadow-sm dark:border-white/30 dark:bg-slate-950"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} {b.name}
            </option>
          ))}
        </Select>
      </div>
      <nav className="flex gap-1" aria-label={t("title")}>
        {TABS.map((key) => (
          <Link
            key={key}
            href={`/hr/attendance?${new URLSearchParams({ branchId, tab: key })}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === key ? "border-blue-600 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </nav>
    </div>
  )
}
