"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { TransportSearchField } from "@/components/transport/toolbar"

const DEBOUNCE_MS = 300

export function JobsListSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlSearch = searchParams.get("search") ?? ""
  const [value, setValue] = useState(urlSearch)

  useEffect(() => {
    setValue(urlSearch)
  }, [urlSearch])

  useEffect(() => {
    const trimmed = value.trim()
    const current = (searchParams.get("search") ?? "").trim()
    if (trimmed === current) return

    const timer = window.setTimeout(() => {
      const q = new URLSearchParams(searchParams.toString())
      q.delete("page")
      if (trimmed) q.set("search", trimmed)
      else q.delete("search")
      const s = q.toString()
      router.push(s ? `${pathname}?${s}` : pathname)
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [value, pathname, router, searchParams])

  return (
    <TransportSearchField
      value={value}
      onChange={setValue}
      placeholder="ค้นหา เลขใบงาน / รถ / คนขับ / ลูกค้า / สินค้า"
      className="min-w-[12rem] sm:min-w-[16rem]"
    />
  )
}
