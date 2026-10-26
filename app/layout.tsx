import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { auth } from "@/lib/auth"
import { APP_BRAND } from "@/shared/branding"
import { getCompanyBrand, getDefaultCompanyBrand } from "@/shared/branding/company-brand"
import { TypeConfirmProvider } from "@/components/ui/type-confirm"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })
const FALLBACK_LOGO = "/home-screen/brand/logo.webp"

export async function generateMetadata(): Promise<Metadata> {
  let logoUrl: string | null = null
  try {
    const session = await auth()
    const brand = session?.user?.companyId
      ? await getCompanyBrand(session.user.companyId)
      : await getDefaultCompanyBrand()
    logoUrl = brand?.logoUrl ?? null
  } catch {
    logoUrl = null
  }
  const icon = logoUrl || FALLBACK_LOGO

  return {
    title: {
      default: APP_BRAND.name,
      template: APP_BRAND.titleTemplate,
    },
    description: APP_BRAND.description,
    icons: {
      icon,
      shortcut: icon,
      apple: icon,
    },
  }
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
