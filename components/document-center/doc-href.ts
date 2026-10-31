export function docHref(
  pathname: string,
  current: Record<string, string | undefined>,
  patch: Record<string, string | null | undefined>
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...current, ...patch })) {
    if (value) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
