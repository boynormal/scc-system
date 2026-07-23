# เพิ่มโมดูล / ย้าย use-case (Contributor)

## หลักการ

1. **Route ไม่เปลี่ยน** — `app/(dashboard)/**` และ `app/api/**` เป็น adapter เรียก `modules/*/application` หรือ `shared/*`
2. **Business logic** อยู่ใน `modules/<name>/application` (และ `domain` เมื่อมี model ชัด)
3. **Prisma / ภายนอก** อยู่ `infra` หรือใช้ `shared/db` ที่ re-export `prisma` ชั่วคราว

## ขั้นตอนสั้นๆ

1. เลือกโมดูลจากตารางใน [modular-folder-blueprint.md](./modular-folder-blueprint.md)
2. เพิ่มฟังก์ชันใน `modules/<name>/application/*.ts` — รับ dependency เป็น argument หรือ import `prisma` จาก `@/shared/db` ตามแบบที่ทีมตกลง
3. ใน `app/api/.../route.ts` เหลือ: auth, parse request, เรียก use-case, map เป็น `NextResponse`
4. เมื่อเมนูมีหน้าใหม่ — เพิ่มโหนดใน [shared/navigation/moduleRegistry.ts](../../shared/navigation/moduleRegistry.ts) (`type: "link" | "group" | "section"`) ระบุ `href`, `moduleId`, `permission`, `keywords` และ `launcher` metadata (`departmentId`, `capabilityId`, `isPrimary`, `badgeKey`) เพื่อให้โผล่ครบทั้ง Sidebar + `/apps` + command palette

## เมนูหลายระดับ / ค้นหา / ต่อบริษัท

- Pipeline บน server: [buildDashboardNav.ts](../../shared/navigation/buildDashboardNav.ts) = `MODULE_NAV_REGISTRY` → `applyCompanyNavOverrides` (จาก `companies.settings.nav`) → `sortNavTree` → `filterNavByPermission` (RBAC)
- Layout โหลด `settings` แล้วส่ง `navItems` เข้า [sidebar.tsx](../../components/layout/sidebar.tsx), หน้า [app/(dashboard)/apps/page.tsx](../../app/(dashboard)/apps/page.tsx), และ [nav-command-palette.tsx](../../components/layout/nav-command-palette.tsx) (Ctrl+K / ⌘K)
- API: `GET|PATCH /api/settings/nav-preferences` — รูปแบบ JSON ใน `companies.settings`: `{ "nav": { "hiddenModuleIds": [], "orderOverrides": {}, "pinnedModuleIds": [], "hiddenDepartmentIds": [], "departmentOrderOverrides": {} } }` — PATCH ต้องมีสิทธิ์ `settings:update`

## Definition of Done (เพิ่มโมดูลใหม่ / ย้าย use-case)

- Route ใน `app/api/**` เหลือแค่ thin adapter: auth (`withAuth`), parse request, เรียก application service, map response — **ไม่มี** business logic หรือ query Prisma ตรงในไฟล์ route (ยกเว้น allowlist ใน [core-platform-convention.md](./core-platform-convention.md#4-route-ที่ได้รับการยกเว้น-import-prisma-ตรงได้))
- มี registry node ครบ metadata (`moduleId`, `keywords`, `launcher`) ถ้ามีหน้าใหม่
- ผ่าน RBAC visibility ตาม role
- มองเห็นได้จาก Sidebar + `/apps` + command palette
- Error handling ผ่าน `AppError` subclass (`ForbiddenError`, `NotFoundError`, `ValidationError`) — ไม่ return `NextResponse` error แบบ ad-hoc ในบล็อก logic
- Response JSON shape เดิม (ถ้าเป็นการย้าย use-case จาก route เดิม) — ไม่เปลี่ยน field/status code โดยไม่แจ้ง
- `npx tsc --noEmit` ผ่าน

## สิทธิ์เมนู

- กรองด้วย [filterNavByPermission.ts](../../shared/navigation/filterNavByPermission.ts) (recursive สำหรับ section/group/link)
- `permission` ต้องสอดคล้อง [lib/permissions.ts](../../lib/permissions.ts)

## อ้างอิง

- [core-platform-convention.md](./core-platform-convention.md) — กฎ import + core layers ที่ทุกโมดูลใช้ร่วมกัน
- [db-blueprint.md](./db-blueprint.md) — แยกตาราง / migration DB
- [rollout-runbook.md](./rollout-runbook.md) — deploy / rollback
