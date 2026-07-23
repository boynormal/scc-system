import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { APP_BRAND } from "@/shared/branding"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: APP_BRAND.name,
    template: APP_BRAND.titleTemplate,
  },
  description: APP_BRAND.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
