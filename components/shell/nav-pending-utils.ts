export type PlainClickInput = {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented?: boolean
}

/** True for an ordinary left click. Modifier clicks and non-self targets stay with the browser. */
export function isPlainLeftClick(event: PlainClickInput, linkTarget?: string | null): boolean {
  if (event.defaultPrevented) return false
  if (event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if (linkTarget && linkTarget !== "_self") return false
  return true
}

function normalizedQuery(query: string): string {
  const raw = query.startsWith("?") ? query.slice(1) : query
  const entries = [...new URLSearchParams(raw).entries()]
  entries.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])))
  return entries.map(([key, value]) => `${key}=${value}`).join("&")
}

/** Compares a tab href with the current path and query, ignoring parameter order. */
export function isSameDestination(href: string, pathname: string, search: string): boolean {
  const splitAt = href.indexOf("?")
  const path = splitAt === -1 ? href : href.slice(0, splitAt)
  const query = splitAt === -1 ? "" : href.slice(splitAt + 1)
  if ((path || "/") !== pathname) return false
  return normalizedQuery(query) === normalizedQuery(search)
}

/**
 * Decides whether the optimistic tab key should stay.
 * `navigating === null` means there is no provider, so any real route change drops the key.
 * A key set before `navigating` flips to true is kept. It clears once the route catches up,
 * or once a navigation that had started is no longer pending.
 */
export function nextPendingKey(input: {
  pendingKey: string | null
  activeKey: string | undefined
  navigating: boolean | null
  wasNavigating: boolean
}): string | null {
  const { pendingKey, activeKey, navigating, wasNavigating } = input
  if (pendingKey == null) return null
  if (navigating == null) return null
  if (pendingKey === activeKey) return null
  if (wasNavigating && !navigating) return null
  return pendingKey
}
