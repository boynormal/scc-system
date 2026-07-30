# Security

แนวทางความปลอดภัยของระบบอ้างอิงจากโค้ดจริงใน repo — อัปเดตเอกสารนี้เมื่อเปลี่ยน auth / secrets / upload

## Authentication

- ใช้ **Auth.js (NextAuth v5)** — session แบบ JWT
- Edge-safe config อยู่ที่ [`lib/auth.config.ts`](../lib/auth.config.ts) (ไม่มี Prisma / bcrypt)
- Runtime auth เต็มอยู่ที่ [`lib/auth.ts`](../lib/auth.ts)
- Middleware: [`middleware.ts`](../middleware.ts) ใช้ `authConfig` เท่านั้น
  - Public: `/login`, `/api/auth`
  - ไม่รัน auth บน `_next/static`, `_next/image`, `favicon.ico`, `/uploads/`, และไฟล์รูปนามสกุลทั่วไป (กัน `<img src="/uploads/...">` ได้ redirect/HTML แทนรูป)

## Authorization (RBAC)

- สิทธิ์ระดับ **branch** ผ่าน roles ใน session
- ตรวจด้วย `hasPermission` / `getBranchIds` จาก [`lib/permissions.ts`](../lib/permissions.ts) (re-export จาก `shared/permissions`)
- Resource / Action ตามแคตตาล็อกใน shared permissions และ module access
- บาง API ตรวจ permission เพิ่มเอง (เช่น upload โปรไฟล์ home-screen ต้องมี `settings:update`)

## API handlers

- ห่อด้วย [`withAuth`](../lib/api-handler.ts): ไม่มี session → `401 Unauthorized`
- โยน [`AppError`](../lib/errors.ts) → JSON `{ error, code }` ตาม status
- ข้อผิดพลาดอื่น → `500` + log ฝั่งเซิร์ฟเวอร์ (ไม่เปิด stack ให้ client)

## Cron endpoints

เส้นทางใต้ `/api/cron/*` **ไม่ใช้ session ผู้ใช้** — ตรวจ:

```http
Authorization: Bearer <CRON_SECRET>
```

ตัวอย่าง: [`app/api/cron/generate-schedules/route.ts`](../app/api/cron/generate-schedules/route.ts)

ตั้งค่า `CRON_SECRET` ใน environment ของเซิร์ฟเวอร์ (ยังไม่มีใน `.env.example` — ต้องเพิ่มเองบน production)

## Secrets และ environment

อ้างอิงรายการใน [`.env.example`](../.env.example) และ [ops/DEPLOYMENT.md](./ops/DEPLOYMENT.md)

| กลุ่ม | ตัวแปรสำคัญ | หมายเหตุ |
|-------|-------------|----------|
| Database | `DATABASE_URL` | ห้าม commit |
| Auth | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | secret ≥ 32 ตัวอักษร |
| Cron | `CRON_SECRET` | บังคับบน production ถ้าเปิด cron |
| GPS | `GPS_API_URL`, `GPS_API_AUTH`, `GPS_ASSET_ID` | **server-only** ห้าม `NEXT_PUBLIC_*` |
| Storage (ถ้าใช้) | `STORAGE_*` | ดูส่วน Upload |
| Email | `RESEND_API_KEY` | ถ้าเปิดส่งเมล |

**ห้าม** commit ไฟล์ `.env` หรือ credential จริง

## Upload และไฟล์

- API: [`app/api/upload/route.ts`](../app/api/upload/route.ts) — ต้อง login
- พฤติกรรมปัจจุบัน: เขียนลงดิสก์ใต้ `public/uploads` และ `public/home-screen/...` (WebP ตาม profile)
- Middleware ยกเว้น `/uploads/` เพื่อให้เสิร์ฟไฟล์ได้โดยไม่ผ่าน redirect login
- ตัวแปร `STORAGE_*` ใน `.env.example` เป็นโครงสำหรับ object storage — ตรวจโค้ดก่อนสมมติว่าทุกอัปโหลดไป R2/S3 แล้ว

## GPS

- Proxy ผ่าน [`/api/transport/gps`](../app/api/transport/gps/route.ts) ใช้ env ฝั่งเซิร์ฟเวอร์เท่านั้น
- อย่าใส่ Basic auth ของ GPS ใน client bundle

## Checklist ก่อนขึ้น production

- [ ] เปลี่ยน `NEXTAUTH_SECRET` / รหัสผ่าน seed
- [ ] ตั้ง `CRON_SECRET` และจำกัดการเรียก cron จาก scheduler ที่เชื่อถือได้
- [ ] ตรวจ `NEXTAUTH_URL` ให้ตรงโดเมนจริง
- [ ] ไม่เปิด debug ที่รั่ว session / SQL
- [ ] สำรอง DB ก่อน migrate — [ops/BACKUP.md](./ops/BACKUP.md)
