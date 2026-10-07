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

describe("HUB and PM CHECK launchers", () => {
  it("registers HUB as an external launcher tile", () => {
    const hub = findLink("hub")
    expect(hub).toBeDefined()
    expect(hub?.href).toBe("https://hub.scharoenchai.cloud")
    expect(isExternalHref(hub!.href)).toBe(true)
    expect(hub?.permission).toEqual({ resource: "dashboards", action: "read" })
    expect(hub?.launcher?.departmentId).toBe("hub")
    expect(DEPARTMENT_BY_ID.hub?.label).toBe("HUB")
    expect(PRODUCT_LINE_BY_ID.hub?.departmentIds).toContain("hub")
  })

  it("registers PM CHECK under the asset register", () => {
    const pm = findLink("pm_check")
    expect(pm).toBeDefined()
    expect(pm?.href).toBe("/pm-check")
    expect(isExternalHref(pm!.href)).toBe(false)
    expect(pm?.permission).toEqual({ resource: "assets", action: "read" })
    expect(pm?.launcher?.departmentId).toBe("asset_register")
  })
})
