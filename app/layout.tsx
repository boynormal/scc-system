import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { APP_BRAND } from "@/shared/branding"
import { TypeConfirmProvider } from "@/components/ui/type-confirm"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: APP_BRAND.name,
    template: APP_BRAND.titleTemplate,
  },
  description: APP_BRAND.description,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TypeConfirmProvider>{children}</TypeConfirmProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
