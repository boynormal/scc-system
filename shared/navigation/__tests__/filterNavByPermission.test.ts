import { describe, expect, it } from "vitest"
import type { UserRole } from "@/lib/permissions"
import { filterNavByPermission } from "@/shared/navigation/filterNavByPermission"
import type {
  ModuleNavNode,
  NavGroupNode,
  NavLinkNode,
  NavSectionNode,
} from "@/shared/navigation/moduleRegistry"

function role(overrides: Partial<UserRole>): UserRole {
  return {
    branchId: "branch-1",
    branchName: "HQ",
    roleName: "Viewer",
    permissions: null,
    ...overrides,
  }
}

function link(overrides: Partial<NavLinkNode>): NavLinkNode {
  return {
    type: "link",
    key: "link",
    href: "/link",
    label: "Link",
    icon: "Wrench",
    permission: { resource: "machines", action: "read" },
    moduleId: "machines",
    ...overrides,
  }
}

function group(children: ModuleNavNode[], overrides: Partial<NavGroupNode> = {}): NavGroupNode {
  return {
    type: "group",
    key: "group",
    label: "Group",
    icon: "Wrench",
    permission: { resource: "machines", action: "read" },
    moduleId: "machines",
    children,
    ...overrides,
  }
}

function section(children: ModuleNavNode[], overrides: Partial<NavSectionNode> = {}): NavSectionNode {
  return {
    type: "section",
    key: "section",
    label: "Section",
    children,
    ...overrides,
  }
}

describe("filterNavByPermission", () => {
  it("keeps a link when the role has the required permission", () => {
    const roles: UserRole[] = [role({ roleName: "Viewer" })]
    const nodes = [link({ key: "machines-link", permission: { resource: "machines", action: "read" } })]

    expect(filterNavByPermission(nodes, roles)).toHaveLength(1)
  })

  it("drops a link when the role lacks the required permission", () => {
    const roles: UserRole[] = [role({ roleName: "Viewer" })]
    // Viewer default has no "delete" on machines
    const nodes = [link({ key: "machines-delete", permission: { resource: "machines", action: "delete" } })]

    expect(filterNavByPermission(nodes, roles)).toHaveLength(0)
  })

  it("drops a link when moduleId is blocked by moduleAccess even if the resource permission passes", () => {
    const roles: UserRole[] = [
      role({ roleName: "Viewer", permissions: { moduleAccess: ["hr"] } as never }),
    ]
    const nodes = [link({ key: "machines-link", moduleId: "transport" })]

    expect(filterNavByPermission(nodes, roles)).toHaveLength(0)
  })

  it("drops a group when none of its children survive filtering", () => {
    const roles: UserRole[] = [role({ roleName: "Viewer" })]
    const nodes = [
      group([link({ key: "machines-delete", permission: { resource: "machines", action: "delete" } })]),
    ]

    expect(filterNavByPermission(nodes, roles)).toHaveLength(0)
  })

  it("keeps a group and only its permitted children when at least one child survives", () => {
    const roles: UserRole[] = [role({ roleName: "Viewer" })]
    const nodes = [
      group([
        link({ key: "machines-read", permission: { resource: "machines", action: "read" } }),
        link({ key: "machines-delete", permission: { resource: "machines", action: "delete" } }),
      ]),
    ]

    const result = filterNavByPermission(nodes, roles)
    expect(result).toHaveLength(1)
    const filteredGroup = result[0] as NavGroupNode
    expect(filteredGroup.children).toHaveLength(1)
    expect(filteredGroup.children[0].key).toBe("machines-read")
  })

  it("keeps the maintenance group when the role can read dashboard, even without maintenance_plans permission", () => {
    const roles: UserRole[] = [role({ roleName: "Viewer" })]
    const nodes = [
      group(
        [link({ key: "dash", permission: { resource: "dashboard", action: "read" } })],
        { key: "maintenance", permission: { resource: "maintenance_plans", action: "delete" } }
      ),
    ]

    // group-level permission check would fail (Viewer has no delete), but the
    // "maintenance" key has a special OR-across-resources escape hatch
    expect(filterNavByPermission(nodes, roles)).toHaveLength(1)
  })

  it("drops a section when it has no children left after filtering", () => {
    const roles: UserRole[] = [role({ roleName: "Viewer" })]
    const nodes = [
      section([link({ key: "machines-delete", permission: { resource: "machines", action: "delete" } })]),
    ]

    expect(filterNavByPermission(nodes, roles)).toHaveLength(0)
  })

  it("keeps a section with only the surviving children", () => {
    const roles: UserRole[] = [role({ roleName: "Viewer" })]
    const nodes = [
      section([
        link({ key: "machines-read", permission: { resource: "machines", action: "read" } }),
        link({ key: "machines-delete", permission: { resource: "machines", action: "delete" } }),
      ]),
    ]

    const result = filterNavByPermission(nodes, roles)
    expect(result).toHaveLength(1)
    expect((result[0] as NavSectionNode).children).toHaveLength(1)
  })

  it("grants notifications:read fallback via dashboard:read for legacy custom roles missing the notifications key", () => {
    const nodes = [link({ key: "notif", permission: { resource: "notifications", action: "read" } })]

    // "Custom Legacy Role" is not one of the 4 canonical names in DEFAULT_ROLE_PERMISSIONS,
    // so mergeRolePermissions cannot backfill a missing "notifications" key from defaults —
    // this is exactly the pre-existing-role-in-DB scenario noted in rollout-runbook.md.
    const rolesMissingNotifications: UserRole[] = [
      role({ roleName: "Custom Legacy Role", permissions: { dashboard: ["read"] } as never }),
    ]

    expect(filterNavByPermission(nodes, rolesMissingNotifications)).toHaveLength(1)
  })

  it("drops the notifications link for legacy custom roles missing both notifications and dashboard read", () => {
    const nodes = [link({ key: "notif", permission: { resource: "notifications", action: "read" } })]
    const roles: UserRole[] = [
      role({ roleName: "Custom Legacy Role", permissions: { dashboard: [] } as never }),
    ]

    expect(filterNavByPermission(nodes, roles)).toHaveLength(0)
  })
})
