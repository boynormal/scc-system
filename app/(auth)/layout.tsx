import { LocaleSwitcher } from "@/components/layout/locale-switcher"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="absolute right-4 top-4 z-10">
        <LocaleSwitcher variant="onDark" />
      </div>
      {children}
    </div>
  )
}
