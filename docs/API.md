# API

convention และแผนที่กลุ่ม endpoint — **ไม่** enumerate ทุก route (มีหลายสิบไฟล์ใต้ `app/api/**`)

รายละเอียดสิทธิ์/ความปลอดภัย: [SECURITY.md](./SECURITY.md)  
Transport application layer: `modules/transport/application` (route เป็น thin adapter)

## Convention

| หัวข้อ | แนวทาง |
|--------|--------|
| ที่อยู่ | Next.js Route Handlers ใน `app/api/**/route.ts` |
| Auth | Session ผ่าน Auth.js; หลาย route ใช้ `withAuth` จาก [`lib/api-handler.ts`](../lib/api-handler.ts) |
| Validation | Zod (และ schema ในโมดูล/route ตามที่แต่ละไฟล์ใช้) |
| Errors | `AppError` → `{ error, code }` + HTTP status; อื่นๆ → 500 |
| ขอบเขตข้อมูล | กรองตาม `companyId` / branch จาก session + RBAC |

### ตัวอย่าง error เมื่อไม่ได้ล็อกอิน

```json
{ "error": "Unauthorized", "code": "UNAUTHORIZED" }
```

สถานะ: `401`

### ตัวอย่างเรียก cron

```http
GET /api/cron/generate-schedules
Authorization: Bearer <CRON_SECRET>
```

ผิด secret → `401`

### ตัวอย่าง list (รูปแบบทั่วไป)

หลาย list API คืนประมาณ:

```json
{ "data": [ /* ... */ ] }
```

ตรวจ response จริงในแต่ละ route — บางอันมี pagination / `error` ต่างรูปแบบเล็กน้อย

## กลุ่ม endpoint หลัก

| กลุ่ม | Prefix | หมายเหตุ |
|-------|--------|----------|
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
