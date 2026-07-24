export { MODULE_NAV_REGISTRY, NAV_ICON_KEYS } from "./moduleRegistry"
export type {
  ModuleNavChild,
  ModuleNavEntry,
  ModuleNavNode,
  NavGroupNode,
  NavIconKey,
  NavLauncherMeta,
  NavLinkNode,
  NavPermissionGate,
  NavSectionNode,
} from "./moduleRegistry"
export { filterNavByPermission } from "./filterNavByPermission"
export { filterNavToActiveContext } from "./filterNavToActiveContext"
export type { AppAppearance, CompanyNavPreferences } from "./companyNavPreferences"
export {
  applyCompanyNavOverrides,
  parseCompanyNavPreferences,
  sortNavTree,
} from "./companyNavPreferences"
export { flattenNavForLauncher, flattenNavForPalette } from "./flattenNav"
export type { FlatNavItem, LauncherAppItem } from "./flattenNav"
export { DEPARTMENT_BY_ID, DEPARTMENT_REGISTRY } from "./departmentRegistry"
export type { DepartmentDef } from "./departmentRegistry"
export { PRODUCT_LINE_BY_ID, PRODUCT_LINE_REGISTRY } from "./productLineRegistry"
export type { ProductLineDef } from "./productLineRegistry"
export { buildDashboardNav } from "./buildDashboardNav"
export { isExternalHref } from "./isExternalHref"
export {
  getFavoriteIds,
  getRecentIds,
  getUsageCounts,
  incrementUsage,
  pushRecent,
  recordAppOpen,
  setFavoriteIds,
  skinFor,
  TILE_SKINS,
} from "./launcherClientState"
export type { TileSkin } from "./launcherClientState"
export {
  filterNavByProductLine,
  getVisibleProductLines,
  pathMatchesHref,
  resolveActiveNavHref,
  resolveActiveProductLineId,
  subtreeContainsActiveHref,
} from "./groupNavByProductLine"
