"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { ModuleTabs, type ModuleTabItem } from "./module-tabs"
import { ModuleTabPortal } from "./module-tab-slot"
import { followTabHref, useNavPending } from "./nav-pending"
import { isPlainLeftClick } from "./nav-pending-utils"

type TabsProps = ComponentProps<typeof ModuleTabs>

function isHrefActive(pathname: string, href: string, exact?: boolean) {
  const path = href.split("?")[0] || href
  if (exact) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

function resolveActiveKey(items: ModuleTabItem[], activeKey: string | undefined, pathname: string) {
  return activeKey ?? items.find((item) => item.href && isHrefActive(pathname, item.href, item.exact))?.key
}

function NavbarTabMenu({
  items,
  activeKey,
  onChange,
  ariaLabel,
}: {
  items: ModuleTabItem[]
  activeKey?: string
  onChange?: (key: string) => void
  ariaLabel: string
}) {
  const t = useTranslations("header")
  const pathname = usePathname()
  const nav = useNavPending()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const shownKey = resolveActiveKey(items, activeKey, pathname)
  const activeLabel = items.find((item) => item.key === shownKey)?.label

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const menuWidth = 240
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8))
      setPosition({ top: rect.bottom + 8, left })
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <div ref={rootRef} className="relative max-w-full">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={activeLabel ? `${t("moduleTabsMenu")}: ${activeLabel}` : t("moduleTabsMenu")}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-white/80 bg-white/40 px-2.5 text-sm font-medium text-foreground dark:border-white/20 dark:bg-white/10"
      >
        <Menu className="h-4 w-4 shrink-0" aria-hidden />
        {activeLabel ? <span className="truncate">{activeLabel}</span> : null}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={ariaLabel}
          style={{ top: position.top, left: position.left }}
          className="fixed z-50 max-h-[min(24rem,calc(100vh-5rem))] w-60 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
        >
          {items.map((item) => {
            const active = item.key === shownKey
            const itemClass = cn(
              "flex w-full rounded-lg px-3 py-2 text-left text-sm font-medium",
              active ? "bg-rose-500 text-white" : "text-foreground hover:bg-muted"
            )
            if (onChange) {
              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  aria-current={active ? "true" : undefined}
                  className={itemClass}
                  onClick={() => {
                    setOpen(false)
                    onChange(item.key)
                  }}
                >
                  {item.label}
                </button>
              )
            }
            if (!item.href) return null
            return (
              <Link
                key={item.key}
                role="menuitem"
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={itemClass}
                onClick={(event) => {
                  setOpen(false)
                  if (!item.href) return
                  if (!nav) return
                  if (!isPlainLeftClick(event)) return
                  followTabHref(event, {
                    href: item.href,
                    scope: "module",
                    nav,
                    select: () => {},
                  })
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function NavbarModuleTabs({ className, items, activeKey, onChange, "aria-label": ariaLabel = "แท็บหลัก", ...props }: TabsProps) {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const [measure, setMeasure] = useState<HTMLDivElement | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const itemKey = items.map((item) => `${item.key}:${item.label}`).join("|")

  useLayoutEffect(() => {
    if (!frame || !measure) return

    const update = () => {
      const needed = measure.offsetWidth
      const available = frame.clientWidth
      const next = needed > available + 1
      setCollapsed((current) => (current === next ? current : next))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    const fonts = document.fonts
    if (fonts?.ready) void fonts.ready.then(update)
    return () => observer.disconnect()
  }, [frame, itemKey, measure])

  if (items.length === 0) return null

  return (
    <ModuleTabPortal>
      <div ref={setFrame} className="relative w-full min-w-0">
        <div className="pointer-events-none absolute left-0 top-0 h-0 w-0 overflow-hidden" aria-hidden>
          <div
            ref={setMeasure}
            className="flex w-max flex-nowrap items-center gap-1 rounded-full border p-1"
          >
            {items.map((item) => (
              <span key={item.key} className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium">
                {item.label}
              </span>
            ))}
          </div>
        </div>
        {collapsed ? (
          <NavbarTabMenu items={items} activeKey={activeKey} onChange={onChange} ariaLabel={ariaLabel} />
        ) : (
          <ModuleTabs
            {...props}
            items={items}
            activeKey={activeKey}
            onChange={onChange}
            aria-label={ariaLabel}
            className={cn("w-max max-w-full flex-nowrap", className)}
          />
        )}
      </div>
    </ModuleTabPortal>
  )
}
