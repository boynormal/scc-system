import type { NavIconKey } from "@/shared/navigation/moduleRegistry"

export type RmnCategoryId = "paper" | "steel" | "precious-metals" | "ewaste"

export type RmnCategory = {
  id: RmnCategoryId
  href: string
  titleKey: "paperTitle" | "steelTitle" | "preciousMetalsTitle" | "ewasteTitle"
  descKey: "paperDesc" | "steelDesc" | "preciousMetalsDesc" | "ewasteDesc"
  icon: NavIconKey
}

export const RMN_CATEGORIES: RmnCategory[] = [
  {
    id: "paper",
    href: "/raw-material-news/paper",
    titleKey: "paperTitle",
    descKey: "paperDesc",
    icon: "FileText",
  },
  {
    id: "steel",
    href: "/raw-material-news/steel",
    titleKey: "steelTitle",
    descKey: "steelDesc",
    icon: "Hammer",
  },
  {
    id: "precious-metals",
    href: "/raw-material-news/precious-metals",
    titleKey: "preciousMetalsTitle",
    descKey: "preciousMetalsDesc",
    icon: "Gem",
  },
  {
    id: "ewaste",
    href: "/raw-material-news/ewaste",
    titleKey: "ewasteTitle",
    descKey: "ewasteDesc",
    icon: "Recycle",
  },
]
