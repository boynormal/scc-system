"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"

export function DashboardBranchFilter({
  branches,
  currentBranchId,
}: {
  branches: { id: string; name: string }[]
  currentBranchId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (branches.length === 0) return null

  const onChange = (value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (!value || value === "all") next.delete("branchId")
    else next.set("branchId", value)
    const q = next.toString()
    router.push(q ? `${pathname}?${q}` : pathname)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="dashboard-branch" className="text-sm font-medium text-slate-600 shrink-0">
        สาขา
      </label>
      <select
        id="dashboard-branch"
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={currentBranchId ?? "all"}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">ทุกสาขา</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  )
}
