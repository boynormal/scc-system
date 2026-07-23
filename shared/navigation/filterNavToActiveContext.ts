import type { ModuleNavNode } from "./moduleRegistry"

function pathMatchesHref(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/"))
}

function subtreeHasActivePath(node: ModuleNavNode, pathname: string): boolean {
  if (node.type === "link") return pathMatchesHref(pathname, node.href)
  if (node.type === "group" || node.type === "section") {
    return node.children.some((c) => subtreeHasActivePath(c, pathname))
  }
  return false
}

/**
 * ตัด sibling ออก: เหลือเฉาะลิงก์/กลุ่มที่นำทางไป path นี้ (หรือบรรพบาลที่มี path นี้)
 */
function pruneTree(
  node: ModuleNavNode,
  pathname: string,
  sectionKey: string | null
): ModuleNavNode | null {
  if (node.type === "link") {
    if (pathMatchesHref(pathname, node.href)) return node
    return null
  }

  const nextSectionKey: string | null = node.type === "section" ? node.key : sectionKey
  const pruned = node.children
    .map((c) => pruneTree(c, pathname, nextSectionKey))
    .filter((c): c is ModuleNavNode => c !== null)

  if (pruned.length === 0) return null
  if (node.type === "section") {
    return { ...node, children: pruned }
  }
  if (node.type === "group") {
    return { ...node, children: pruned }
  }
  return null
}

/** คู่กับ product line "การจัดการซ่อมบำรุง" — แสดงคู่กับเครื่องจักร */
const MACHINE_COMPANION_OPERATION_KEYS = new Set(["maintenance", "work_orders", "notifications"])

/**
 * บน /machines ให้เห็น "ภาพรวม" (เครื่องจักร) คู่กับรายการในกลุ่มงานซ่อม (แดชบอร์ด · แผน PM · รายงาน · WO · แจ้งเตือน)
 * โดยไม่เอา อะไหล่ ฯลฯ มาปน
 */
function navForMachineRoutes(navItems: ModuleNavNode[], pathname: string): ModuleNavNode[] | null {
  if (pathname !== "/machines" && !pathname.startsWith("/machines/")) {
    return null
  }

  const overview = navItems.find((n) => n.type === "section" && n.key === "sec_overview")
  if (!overview || overview.type !== "section") return null

  const overviewPruned = pruneTree(overview, pathname, null)
  if (!overviewPruned || overviewPruned.type !== "section") return null

  const operations = navItems.find((n) => n.type === "section" && n.key === "sec_operations")
  if (!operations || operations.type !== "section") {
    return [overviewPruned]
  }

  const companionChildren = operations.children.filter((c) => MACHINE_COMPANION_OPERATION_KEYS.has(c.key))
  if (companionChildren.length === 0) {
    return [overviewPruned]
  }

  const workMgmtSection: ModuleNavNode = {
    ...operations,
    key: "sec_work_mgmt_beside_machines",
    label: "การจัดการซ่อมบำรุง",
    children: companionChildren,
  }

  return [overviewPruned, workMgmtSection]
}

/** ใต้ /hr ให้เห็นทั้งบุคลากรและบันทึกเวลาใน sidebar (ไม่ prune sibling) */
function navForHrRoutes(navItems: ModuleNavNode[], pathname: string): ModuleNavNode[] | null {
  if (!pathname.startsWith("/hr")) return null
  const people = navItems.find((n) => n.type === "section" && n.key === "sec_people")
  if (!people || people.type !== "section") return null
  return [people]
}

/** ใต้ /settings ให้เห็นเมนูตั้งค่าครบชุดที่ผ่าน RBAC */
function navForSettingsRoutes(navItems: ModuleNavNode[], pathname: string): ModuleNavNode[] | null {
  if (!pathname.startsWith("/settings")) return null
  const settings = navItems.find((n) => n.type === "group" && n.key === "settings")
  if (!settings || settings.type !== "group") return null
  return [settings]
}

/**
 * ลดรายการเมนูฝั่ง sidebar บน route ลึก:
 * 1) หา **กลุ่ม root หนึ่งกลุ่ม** ที่ต้น tree ที่มี path นี้
 * 2) ภายในกลุ่มนั้น **ตัด sibling** ออก (เหลือเฉพาะสาขาไป path นี้)
 *
 * - หน้า dashboard (`/`) แสดง tree เต็ม
 * - `/machines` — แสดงภาพรวม + หมวดงานซ่อมที่เกี่ยวข้อง (ดู `navForMachineRoutes`)
 * - `/hr/*` — แสดงหมวดบุคลากรครบ (ดู `navForHrRoutes`)
 * - `/settings/*` — แสดงกลุ่มตั้งค่าครบ (ดู `navForSettingsRoutes`)
 * - หาก match 0 หรือมากกว่า 1 กลุ่มระดับ root — คืน tree เต็ม (fail-open)
 */
export function filterNavToActiveContext(navItems: ModuleNavNode[], pathname: string | null | undefined): ModuleNavNode[] {
  if (!pathname || pathname === "/") return navItems

  const machineNav = navForMachineRoutes(navItems, pathname)
  if (machineNav) {
    return machineNav
  }

  const hrNav = navForHrRoutes(navItems, pathname)
  if (hrNav) {
    return hrNav
  }

  const settingsNav = navForSettingsRoutes(navItems, pathname)
  if (settingsNav) {
    return settingsNav
  }

  const roots: ModuleNavNode[] = []
  for (const n of navItems) {
    if (subtreeHasActivePath(n, pathname)) {
      roots.push(n)
    }
  }
  if (roots.length !== 1) {
    return navItems
  }

  const pruned = pruneTree(roots[0]!, pathname, null)
  if (!pruned) {
    return navItems
  }
  return [pruned]
}
