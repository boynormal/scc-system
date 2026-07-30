"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Building2,
  Database,
  Info,
  LayoutGrid,
  Moon,
  Palette,
  Search,
  ShieldCheck,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react"
import { GlassCard, GlassInput, GlassStatCard } from "@/components/glass"
import { Switch } from "@/components/ui/switch"
import { APP_BRAND } from "@/shared/branding"
import type { AppAppearance } from "@/shared/navigation/companyNavPreferences"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

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
  const t = useTranslations("settings")
  const router = useRouter()
  const pathname = usePathname()
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
        label: t("usersTitle"),
        description: "จัดการบัญชีผู้ใช้และสิทธิ์การเข้าถึงระบบ",
        icon: Users,
        keywords: ["users", "ผู้ใช้", "account", "บัญชี"],
      })
    }
    if (access.roles) {
      accessEntries.push({
        id: "roles",
        href: "/settings/roles",
        label: t("rolesTitle"),
        description: "กำหนดบทบาทและสิทธิ์การเข้าถึงแต่ละโมดูล",
        icon: ShieldCheck,
        keywords: ["roles", "สิทธิ์", "rbac", "permission"],
      })
    }
    if (access.branches) {
      accessEntries.push({
        id: "branches",
        href: "/settings/branches",
        label: t("branchesTitle"),
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
        label: t("masterDataTitle"),
        entries: [
          {
            id: "master-data",
            href: "/settings/master-data",
            label: t("masterDataTitle"),
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
        label: t("homeScreenTitle"),
        entries: [
          {
            id: "home-screen",
            href: "/settings/home-screen",
            label: t("appIconsTitle"),
            description: "อัปโหลดภาพกลุ่มงานและโมดูลย่อย — เก็บที่ public/home-screen เพื่อ commit ขึ้น git",
            icon: LayoutGrid,
            keywords: ["icon", "ไอคอน", "รูปภาพ", "apps", "หน้าหลัก", "โมดูล"],
            valueLabel: customIconCount > 0 ? `ปรับแล้ว ${customIconCount} รายการ` : "ไอคอนเริ่มต้น",
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
  }, [access, currentAppearance, customIconCount, appVersion, t])

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
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("hubTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("hubDesc")}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <GlassStatCard
          label="ธีม"
          value={currentAppearance === "dark" ? "มืด" : "สว่าง"}
          icon={currentAppearance === "dark" ? Moon : Sun}
          className="p-3"
        />
        <GlassStatCard label="ไอคอน" value={customIconCount} icon={Palette} className="p-3" />
        <GlassStatCard label="เวอร์ชัน" value={appVersion} icon={Info} className="p-3" />
      </div>

      <GlassInput
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="ค้นหาการตั้งค่า..."
        aria-label="ค้นหาการตั้งค่า"
        icon={<Search className="h-4 w-4" />}
        className="h-10 rounded-xl"
      />

      {isSearching ? (
        <GlassCard padding="none">
          {filteredEntries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              ไม่พบการตั้งค่าที่ตรงกับ “{search.trim()}”
            </p>
          ) : (
            <ul className="divide-y divide-border/80 dark:divide-white/10">
              {filteredEntries.map((entry) => (
                <HubRow
                  key={entry.id}
                  entry={entry}
                  sublabel={entry.sectionLabel}
                  appearance={currentAppearance}
                  savingAppearance={savingAppearance}
                  onToggleAppearance={toggleAppearance}
                  pathname={pathname}
                />
              ))}
            </ul>
          )}
        </GlassCard>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.id}>
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {section.label}
              </p>
              <GlassCard padding="none">
                <ul className="divide-y divide-border/80 dark:divide-white/10">
                  {section.entries.map((entry) => (
                    <HubRow
                      key={entry.id}
                      entry={entry}
                      appearance={currentAppearance}
                      savingAppearance={savingAppearance}
                      onToggleAppearance={toggleAppearance}
                      pathname={pathname}
                    />
                  ))}
                </ul>
              </GlassCard>
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
  pathname,
}: {
  entry: HubEntry
  sublabel?: string
  appearance: AppAppearance
  savingAppearance: boolean
  onToggleAppearance: () => void
  pathname: string
}) {
  const Icon = entry.icon
  const isSwitch = entry.render === "appearance-switch"
  const active =
    !!entry.href &&
    (pathname === entry.href || pathname.startsWith(`${entry.href}/`))

  const inner = (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground",
          active
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-950/50 dark:text-blue-300"
            : "border-glass bg-glass-soft"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {entry.label}
          {sublabel && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">{sublabel}</span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{entry.description}</p>
      </div>
      {isSwitch ? (
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-xs font-medium text-muted-foreground">
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
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
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
      <Link
        href={entry.href}
        className={cn(
          "block transition",
          active
            ? "bg-blue-50/80 dark:bg-blue-950/30"
            : "hover:bg-white/40 dark:hover:bg-white/5"
        )}
      >
        {inner}
      </Link>
    </li>
  )
}
