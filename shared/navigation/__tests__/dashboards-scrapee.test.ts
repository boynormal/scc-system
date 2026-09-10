import { describe, expect, it } from "vitest"
import { MODULE_NAV_REGISTRY, type NavLinkNode } from "@/shared/navigation/moduleRegistry"
import { DEPARTMENT_BY_ID } from "@/shared/navigation/departmentRegistry"
import { PRODUCT_LINE_BY_ID } from "@/shared/navigation/productLineRegistry"
import { isExternalHref } from "@/shared/navigation/isExternalHref"

function findLink(key: string): NavLinkNode | undefined {
  for (const node of MODULE_NAV_REGISTRY) {
    if (node.type !== "section") continue
    const found = node.children.find((c): c is NavLinkNode => c.type === "link" && c.key === key)
    if (found) return found
  }
  return undefined
}

describe("dashboards Scrapee launcher", () => {
  it("registers Scrapee as an external Dashboard launcher tile", () => {
    const scrapee = findLink("dashboards_scrapee")
    expect(scrapee).toBeDefined()
    expect(scrapee?.href).toBe("https://scrapee.scharoenchai.cloud/")
    expect(isExternalHref(scrapee!.href)).toBe(true)
    expect(scrapee?.permission).toEqual({ resource: "dashboards", action: "read" })
    expect(scrapee?.launcher?.departmentId).toBe("dashboards")
    expect(scrapee?.launcher?.isPrimary).toBe(true)

    expect(DEPARTMENT_BY_ID.dashboards?.label).toBe("Dashboard")
    expect(PRODUCT_LINE_BY_ID.dashboards?.departmentIds).toContain("dashboards")
  })
})
