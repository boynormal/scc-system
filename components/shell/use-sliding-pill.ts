"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { nextPendingKey } from "./nav-pending-utils"
import { useNavPending } from "./nav-pending"

type Box = { left: number; top: number; width: number; height: number }

export const SLIDING_PILL_BASE = "pointer-events-none absolute left-0 top-0"
export const SLIDING_PILL_MOTION =
  "transition-[transform,width,height] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"

/**
 * Tracks one highlight box under the selected tab. `select` moves it on click,
 * before navigation finishes; it falls back to `activeKey` once that changes.
 */
export function useSlidingPill(enabled: boolean, activeKey: string | undefined) {
  const rootRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [ready, setReady] = useState(false)
  const nav = useNavPending()
  const navigating = nav ? nav.pending : null
  const wasNavigating = useRef(false)
  const shownKey = enabled ? (pendingKey ?? activeKey) : activeKey

  useEffect(() => {
    setPendingKey((current) =>
      nextPendingKey({
        pendingKey: current,
        activeKey,
        navigating,
        wasNavigating: wasNavigating.current,
      })
    )
    if (navigating != null) wasNavigating.current = navigating
  }, [activeKey, navigating])

  const measure = useCallback(() => {
    const node = shownKey ? itemRefs.current.get(shownKey) : undefined
    const next = node
      ? { left: node.offsetLeft, top: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight }
      : null
    setBox((prev) =>
      prev && next && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height
        ? prev
        : next
    )
  }, [shownKey])

  useLayoutEffect(() => {
    if (enabled) measure()
  })

  useEffect(() => {
    if (!enabled || !box || ready) return
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [enabled, box, ready])

  useEffect(() => {
    if (!enabled || !rootRef.current || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => measure())
    observer.observe(rootRef.current)
    return () => observer.disconnect()
  }, [enabled, measure])

  const setItemRef = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (node) itemRefs.current.set(key, node)
      else itemRefs.current.delete(key)
    },
    []
  )

  const select = useCallback(
    (key: string) => {
      if (enabled) setPendingKey(key)
    },
    [enabled]
  )

  const pillStyle: CSSProperties | null =
    enabled && box
      ? { width: box.width, height: box.height, transform: `translate(${box.left}px, ${box.top}px)` }
      : null

  return { rootRef, setItemRef, shownKey, select, pillStyle, ready }
}
