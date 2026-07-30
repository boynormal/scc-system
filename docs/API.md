# API

convention และแผนที่กลุ่ม endpoint — **ไม่** enumerate ทุก route (มีหลายสิบไฟล์ใต้ `app/api/**`)

รายละเอียดสิทธิ์/ความปลอดภัย: [SECURITY.md](./SECURITY.md)  
Transport application layer: `modules/transport/application` (route เป็น thin adapter)  
กฎ import: [architecture/core-platform-convention.md](./architecture/core-platform-convention.md)

## Convention

| หัวข้อ | แนวทาง |
|--------|--------|
| ที่อยู่ | Next.js Route Handlers ใน `app/api/**/route.ts` |
| Auth | Session ผ่าน Auth.js; หลาย route ใช้ `withAuth` จาก [`lib/api-handler.ts`](../lib/api-handler.ts) |
| Validation | Zod (และ schema ในโมดูล/route ตามที่แต่ละไฟล์ใช้) |
| Errors | เป้า: `AppError` → `{ error, code }` + HTTP status (ดูด้านล่าง); อื่นๆ → 500 |
| ขอบเขตข้อมูล | กรองตาม `companyId` / branch จาก session + RBAC |

### Errors — เป้า / มาตรฐาน `withAuth`

จาก [`lib/api-handler.ts`](../lib/api-handler.ts) และ [`lib/errors.ts`](../lib/errors.ts):

```json
{ "error": "<message>", "code": "<CODE>" }
```

| Code | Status | แหล่ง |
|------|--------|--------|
| `UNAUTHORIZED` | 401 | ไม่มี session / `UnauthorizedError` |
| `FORBIDDEN` | 403 | `ForbiddenError` |
| `NOT_FOUND` | 404 | `NotFoundError` |
| `VALIDATION_ERROR` | 400 | `ValidationError` |
| `INTERNAL_ERROR` | 500 | ข้อผิดพลาดที่ไม่ใช่ `AppError` (ไม่เปิด stack ให้ client) |

ตัวอย่างเมื่อไม่ได้ล็อกอิน (`withAuth`):

```json
{ "error": "Unauthorized", "code": "UNAUTHORIZED" }
```

### Errors — as-is ที่ยังมี (legacy / โดเมน)

ยังไม่บังคับ unify ทั้งระบบในรอบเอกสารนี้ — รู้ไว้ตอนอ่าน/แก้ route:

- บาง route เก่า: `{ "error": "Unauthorized" }` **ไม่มี** `code`
- Zod บางจุด: `{ "error": <zod flatten object> }` แทนข้อความ + `VALIDATION_ERROR`
- GPS และโดเมนเฉพาะ: มี `code` ของตัวเอง เช่น `GPS_NOT_CONFIGURED`, `GPS_UPSTREAM_ERROR`, `GPS_FETCH_ERROR`

### Success — รูปแบบที่ใช้บ่อย

| กรณี | Shape | หมายเหตุ |
|------|--------|----------|
| อ่านรายการ / รายการเดียว | `{ "data": ... }` | ใช้กว้างขวาง |
| สร้างใหม่ | `{ "data": ... }` + HTTP `201` | |
| ลบ (บาง route) | `{ "success": true }` | เช่น transport vehicle/driver delete |
| List แบบแบ่งหน้า | `{ "data", "total", "page", "pageSize", "totalPages" }` | ตัวอย่าง: HR personnel/attendance, machines list service |

ตัวอย่าง list ไม่แบ่งหน้า:

```json
{ "data": [ /* ... */ ] }
```

ตัวอย่าง list แบ่งหน้า (เป้าเมื่อเพิ่ม list API ใหม่ที่ต้อง paginate):

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "pageSize": 20,
  "totalPages": 0
}
```

**Variant:** บาง service (เช่น transport repairs) ใช้ `meta: { total, truncated, ... }` — อย่าเพิ่มรูปแบบ `meta` ใหม่โดยไม่จำเป็น; โค้ด list ใหม่ให้ใช้ envelope แบ่งหน้าด้านบน

### กฎสำหรับโค้ดใหม่ / เมื่อแก้ route

- ชอบ `withAuth` + throw `AppError` + คืน `{ error, code }`
- List ใหม่ที่ต้องแบ่งหน้า: ใช้ `{ data, total, page, pageSize, totalPages }`
- ห้ามเปลี่ยน response shape แบบ breaking โดยไม่ตั้งใจ — ถ้าเปลี่ยน ต้องอัปเดต caller (UI/client) คู่กัน
- รายละเอียดรูปแบบที่ route เก่ายังต่างจากเป้า: ดูตาราง as-is ด้านบน ไม่เดาจาก route เดียว

### ตัวอย่างเรียก cron

```http
GET /api/cron/generate-schedules
Authorization: Bearer <CRON_SECRET>
```

ผิด secret → `401`

## กลุ่ม endpoint หลัก

| กลุ่ม | Prefix | หมายเหตุ |
|--------|--------|----------|
| Auth | `/api/auth/*` | NextAuth |
| Machines | `/api/machines` | รวม images, products, spare-parts ย่อย |
| Maintenance / Schedules | `/api/maintenance-plans`, `/api/schedules` | |
| Work Orders | `/api/work-orders` | |
| Spare Parts | `/api/spare-parts` | |
| Master data | `/api/master-data/*` | categories, departments, suppliers, maintenance-types, branches, roles |
| Settings | `/api/settings/*` | branches, roles, nav-preferences |
| Users | `/api/users` | IAM |
| HR | `/api/hr/*` | personnel, attendance (+ import) |
| Transport | `/api/transport/*` | jobs, GPS, vehicles, drivers, calendar, repairs, tires, master-data |
| Notifications | `/api/notifications` | |
| Upload | `/api/upload` | ต้อง login; เขียน `public/uploads` / home-screen |
| Weather | `/api/weather` | launcher |
| Cron | `/api/cron/*` | `CRON_SECRET` — ไม่ใช้ session ผู้ใช้ |

## หาโค้ดเร็วๆ

1. ดู prefix ในตารางด้านบน → โฟลเดอร์ใต้ `app/api/`
2. ถ้าเป็น transport → logic หลักอยู่ `modules/transport/application`
3. กฎ shared / import: [ARCHITECTURE.md](./ARCHITECTURE.md) → core-platform-convention
