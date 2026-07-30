import type { AppAppearance } from "@/shared/navigation/companyNavPreferences"

export type { AppAppearance }

/** Cookie that stores the active UI appearance for this browser. */
export const APPEARANCE_COOKIE = "scc_appearance"

export const APPEARANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isAppAppearance(value: unknown): value is AppAppearance {
  return value === "light" || value === "dark"
}

export function parseAppearanceCookie(raw: string | undefined | null): AppAppearance | null {
  if (!raw) return null
  return isAppAppearance(raw) ? raw : null
}

/** Cookie wins when set; otherwise company nav preference fallback. */
export function resolveAppearance(
  cookieRaw: string | undefined | null,
  companyFallback: AppAppearance = "light"
): AppAppearance {
  return parseAppearanceCookie(cookieRaw) ?? companyFallback
}

/** Client-side cookie write (path=/, 1 year, SameSite=Lax). */
export function setAppearanceCookie(next: AppAppearance) {
  document.cookie = `${APPEARANCE_COOKIE}=${next};path=/;max-age=${APPEARANCE_COOKIE_MAX_AGE};SameSite=Lax`
}
