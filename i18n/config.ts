export const locales = ["th", "en"] as const

export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = "th"

/** Cookie that stores the active UI locale (no URL prefix). */
export const LOCALE_COOKIE = "scc_locale"

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value)
}
