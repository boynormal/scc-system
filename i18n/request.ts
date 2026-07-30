import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"
import { defaultLocale, isAppLocale, LOCALE_COOKIE, type AppLocale } from "./config"

async function loadMessages(locale: AppLocale) {
  const mod = await import(`../messages/${locale}.json`)
  return (mod.default ?? mod) as Record<string, unknown>
}

export default getRequestConfig(async () => {
  const store = await cookies()
  const raw = store.get(LOCALE_COOKIE)?.value
  const locale: AppLocale = isAppLocale(raw) ? raw : defaultLocale

  return {
    locale,
    messages: await loadMessages(locale),
    onError(error) {
      if (error.code === "MISSING_MESSAGE") {
        console.warn(`[i18n] ${error.message}`)
        return
      }
      console.error(error)
    },
    getMessageFallback({ namespace, key }) {
      return namespace ? `${namespace}.${key}` : key
    },
  }
})
