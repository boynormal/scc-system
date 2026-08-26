import Link from "next/link"
import { EmptyState } from "@/components/ui/empty-state"
import { NAV_ICON_MAP } from "@/components/layout/nav-icon-map"
import type { NavIconKey } from "@/shared/navigation/moduleRegistry"

type Props = {
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
  backLabel: string
  icon: NavIconKey
}

export function EmptyCategoryPage({
  title,
  description,
  emptyTitle,
  emptyDescription,
  backLabel,
  icon,
}: Props) {
  const Icon = NAV_ICON_MAP[icon]

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/raw-material-news"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {backLabel}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} />
    </div>
  )
}
