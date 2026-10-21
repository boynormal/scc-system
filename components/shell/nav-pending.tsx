"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { isPlainLeftClick, isSameDestination } from "./nav-pending-utils"

export type NavScope = "module" | "section"

type NavPendingValue = {
  pending: boolean
  scope: NavScope | null
  navigate: (href: string, scope: NavScope) => void
}

const NavPendingContext = createContext<NavPendingValue | null>(null)

const SHOW_DELAY_MS = 150

export function useNavPending(): NavPendingValue | null {
  return useContext(NavPendingContext)
}

export function NavPendingProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [scope, setScope] = useState<NavScope | null>(null)
  const requestRef = useRef<string | null>(null)
  const pendingRef = useRef(pending)
  pendingRef.current = pending

  useEffect(() => {
    if (!pending) requestRef.current = null
  }, [pending])

  const navigate = useCallback(
    (href: string, nextScope: NavScope) => {
      if (pendingRef.current && requestRef.current === href) return
      requestRef.current = href
      setScope(nextScope)
      startTransition(() => {
        router.push(href, { scroll: false })
      })
    },
    [router]
  )

  const value = useMemo<NavPendingValue>(
    () => ({ pending, scope: pending ? scope : null, navigate }),
    [pending, scope, navigate]
  )

  return (
    <NavPendingContext.Provider value={value}>
      <TopProgressBar pending={pending} />
      {children}
    </NavPendingContext.Provider>
  )
}

function TopProgressBar({ pending }: { pending: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!pending) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [pending])

  if (!visible) return null

  return (
    <div
      role="progressbar"
      aria-label="กำลังโหลด"
      aria-busy="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-primary/25"
    >
      <div className="nav-pending-bar h-full bg-primary" />
    </div>
  )
}

export function PendingFade({
  scope,
  children,
  className,
}: {
  scope: NavScope
  children: ReactNode
  className?: string
}) {
  const nav = useNavPending()
  const dimmed = Boolean(nav?.pending && nav.scope === scope)

  return (
    <div
      className={cn(
        "transition-opacity duration-200 motion-reduce:transition-none",
        dimmed && "pointer-events-none opacity-50",
        className
      )}
      aria-busy={dimmed}
    >
      {children}
    </div>
  )
}

/** Plain left clicks slide the tab and navigate through the provider. Other clicks stay on the link. */
export function followTabHref(
  event: MouseEvent<HTMLAnchorElement>,
  options: { href: string; scope: NavScope; nav: NavPendingValue | null; select: () => void }
) {
  if (!options.nav) return
  if (!isPlainLeftClick(event, event.currentTarget.getAttribute("target"))) return
  if (isSameDestination(options.href, window.location.pathname, window.location.search)) {
    event.preventDefault()
    return
  }
  event.preventDefault()
  options.select()
  options.nav.navigate(options.href, options.scope)
}
