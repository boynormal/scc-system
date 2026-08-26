import Link from "next/link"
import { GlassCard } from "@/components/glass"
import { NAV_ICON_MAP } from "@/components/layout/nav-icon-map"
import { RMN_CATEGORIES } from "@/components/raw-material-news/categories"

type Props = {
  title: string
  description: string
  categories: { href: string; title: string; description: string; iconKey: (typeof RMN_CATEGORIES)[number]["icon"] }[]
}

export function RawMaterialNewsHub({ title, description, categories }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {categories.map((category) => {
          const Icon = NAV_ICON_MAP[category.iconKey]
          return (
            <Link key={category.href} href={category.href} className="block min-w-0">
              <GlassCard className="h-full transition-colors hover:bg-muted/40">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-foreground">{category.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
                  </div>
                </div>
              </GlassCard>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
