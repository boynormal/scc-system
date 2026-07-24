"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2,
  Database,
  Info,
  LayoutGrid,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { APP_BRAND } from "@/shared/branding"
import type { AppAppearance } from "@/shared/navigation/companyNavPreferences"
import { cn } from "@/lib/utils"

type HubAccess = {
  users: boolean
  branches: boolean
  roles: boolean
  masterData: boolean
  homeScreen: boolean
}

type HubEntry = {
  id: string
  href?: string
  label: string
  description: string
  icon: LucideIcon
  keywords: string[]
  valueLabel?: string
  render?: "appearance-switch"
}

type HubSection = {
  id: string
  label: string
  entries: HubEntry[]
}

export function SettingsHub({
  access,
  appearance,
  customIconCount,
  appVersion,
}: {
  access: HubAccess
  appearance: AppAppearance
  customIconCount: number
  appVersion: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [currentAppearance, setCurrentAppearance] = useState<AppAppearance>(appearance)
  const [savingAppearance, setSavingAppearance] = useState(false)

  const toggleAppearance = async () => {
    const next: AppAppearance = currentAppearance === "dark" ? "light" : "dark"
    setCurrentAppearance(next)
    setSavingAppearance(true)
    try {
      const res = await fetch("/api/settings/nav-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appearance: next }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        setCurrentAppearance(currentAppearance)
      }
    } catch {
      setCurrentAppearance(currentAppearance)
    } finally {
      setSavingAppearance(false)
    }
  }

  const sections = useMemo<HubSection[]>(() => {
    const list: HubSection[] = []

    const accessEntries: HubEntry[] = []
    if (access.users) {
      accessEntries.push({
        id: "users",
        href: "/settings/users",
        label: "ผู้ใช้งาน",
        description: "จัดการบัญชีผู้ใช้และสิทธิ์การเข้าถึงระบบ",
        icon: Users,
        keywords: ["users", "ผู้ใช้", "account", "บัญชี"],
      })
    }
    if (access.roles) {
      accessEntries.push({
        id: "roles",
        href: "/settings/roles",
        label: "สิทธิ์การใช้งาน",
        description: "กำหนดบทบาทและสิทธิ์การเข้าถึงแต่ละโมดูล",
        icon: ShieldCheck,
        keywords: ["roles", "สิทธิ์", "rbac", "permission"],
      })
    }
    if (access.branches) {
      accessEntries.push({
        id: "branches",
        href: "/settings/branches",
        label: "สาขา",
        description: "จัดการรายชื่อสาขาและที่ตั้งขององค์กร",
        icon: Building2,
        keywords: ["branches", "สาขา", "location"],
      })
    }
    if (accessEntries.length > 0) {
      list.push({ id: "access", label: "บัญชีและสิทธิ์การเข้าถึง", entries: accessEntries })
    }

    if (access.masterData) {
      list.push({
        id: "master-data",
        label: "ข้อมูลพื้นฐาน",
        entries: [
          {
            id: "master-data",
            href: "/settings/master-data",
            label: "ข้อมูลพื้นฐาน (Master Data)",
            description: "หมวดหมู่ แผนก ประเภทงานซ่อม และซัพพลายเออร์",
            icon: Database,
            keywords: ["master data", "ข้อมูลพื้นฐาน", "categories", "suppliers"],
          },
        ],
      })
    }

    if (access.homeScreen) {
      list.push({
        id: "home-screen",
        label: "หน้าจอหลัก",
        entries: [
          {
            id: "home-screen",
            href: "/settings/home-screen",
            label: "ไอคอนหมวดหมู่",
            description: "อัปโหลดภาพสำหรับกลุ่มงานบน Sidebar และหน้า /apps (หน้าหลัก)",
            icon: LayoutGrid,
            keywords: ["icon", "ไอคอน", "รูปภาพ", "apps", "หน้าหลัก"],
            valueLabel: customIconCount > 0 ? `ปรับแล้ว ${customIconCount} หมวดหมู่` : "ไอคอนเริ่มต้น",
          },
          {
            id: "appearance",
            label: "ธีม (Appearance)",
            description: "สลับโหมดสว่าง/มืดสำหรับหน้า Settings, /apps (หน้าหลัก) และ /app2",
            icon: currentAppearance === "dark" ? Moon : Sun,
            keywords: ["theme", "ธีม", "dark", "มืด", "light", "สว่าง", "appearance"],
            valueLabel: currentAppearance === "dark" ? "มืด" : "สว่าง",
            render: "appearance-switch",
          },
        ],
      })
    }

    list.push({
      id: "about",
      label: "เกี่ยวกับ",
      entries: [
        {
          id: "about",
          label: APP_BRAND.name,
          description: APP_BRAND.tagline,
          icon: Info,
          keywords: ["about", "เกี่ยวกับ", "version", "เวอร์ชัน"],
          valueLabel: `เวอร์ชัน ${appVersion}`,
        },
      ],
    })

    return list
  }, [access, currentAppearance, customIconCount, appVersion])

  const query = search.trim().toLowerCase()
  const isSearching = query.length > 0

  const filteredEntries = useMemo(() => {
    if (!isSearching) return []
    return sections.flatMap((section) =>
      section.entries
        .filter(
          (entry) =>
            entry.label.toLowerCase().includes(query) ||
            entry.description.toLowerCase().includes(query) ||
            entry.keywords.some((k) => k.toLowerCase().includes(query))
        )
        .map((entry) => ({ ...entry, sectionLabel: section.label }))
    )
  }, [isSearching, query, sections])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">ตั้งค่า</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          ค้นหาและจัดการการตั้งค่าของระบบ
        </p>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาการตั้งค่า..."
          className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/40"
          aria-label="ค้นหาการตั้งค่า"
        />
      </label>

      {isSearching ? (
        <Card padding="none">
          {filteredEntries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              ไม่พบการตั้งค่าที่ตรงกับ “{search.trim()}”
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredEntries.map((entry) => (
                <HubRow
                  key={entry.id}
                  entry={entry}
                  sublabel={entry.sectionLabel}
                  appearance={currentAppearance}
                  savingAppearance={savingAppearance}
                  onToggleAppearance={toggleAppearance}
                />
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.id}>
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                {section.label}
              </p>
              <Card padding="none">
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {section.entries.map((entry) => (
                    <HubRow
                      key={entry.id}
                      entry={entry}
                      appearance={currentAppearance}
                      savingAppearance={savingAppearance}
                      onToggleAppearance={toggleAppearance}
                    />
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HubRow({
  entry,
  sublabel,
  appearance,
  savingAppearance,
  onToggleAppearance,
}: {
  entry: HubEntry
  sublabel?: string
  appearance: AppAppearance
  savingAppearance: boolean
  onToggleAppearance: () => void
}) {
  const Icon = entry.icon
  const isSwitch = entry.render === "appearance-switch"

  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {entry.label}
          {sublabel && (
            <span className="ml-2 text-xs font-normal text-slate-400">{sublabel}</span>
          )}
        </p>
        <p className="truncate text-xs text-slate-400">{entry.description}</p>
      </div>
      {isSwitch ? (
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {appearance === "dark" ? "มืด" : "สว่าง"}
          </span>
          <Switch
            checked={appearance === "dark"}
            onCheckedChange={onToggleAppearance}
            disabled={savingAppearance}
            aria-label="สลับโหมดสว่าง/มืด"
          />
        </div>
      ) : (
        entry.valueLabel && (
          <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
            {entry.valueLabel}
          </span>
        )
      )}
    </div>
  )

  if (!entry.href) {
    return <li className={cn(isSwitch && "select-none")}>{inner}</li>
  }

  return (
    <li>
      <Link href={entry.href} className="block transition hover:bg-slate-50 dark:hover:bg-slate-700/40">
        {inner}
      </Link>
    </li>
  )
}
