# Deployment

วิธีติดตั้งและ deploy แอปนี้บน Node process / VPS (repo **ยังไม่มี** Dockerfile — ไม่สร้างในรอบเอกสารนี้)

ดูเพิ่ม: [SECURITY.md](../SECURITY.md), [BACKUP.md](./BACKUP.md), [architecture/rollout-runbook.md](../architecture/rollout-runbook.md)

## Prerequisites

- Node.js 20+ (แนะนำ LTS ที่ทีมใช้ build ได้)
- PostgreSQL 15+
- npm (ล็อกเวอร์ชันตาม `package-lock.json`)

## Environment

1. คัดลอก [`.env.example`](../../.env.example) → `.env`
2. ตั้งอย่างน้อย:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (URL สาธารณะของแอป)
3. Production เพิ่ม:
   - `CRON_SECRET` (ถ้าใช้ `/api/cron/*`)
   - `GPS_API_URL` / `GPS_API_AUTH` / `GPS_ASSET_ID` (ถ้าใช้แผนที่/มอนิเตอร์ขนส่ง)
4. รายละเอียดความปลอดภัย: [SECURITY.md](../SECURITY.md)

## ติดตั้งและรัน (ครั้งแรก / เครื่องใหม่)

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

พัฒนาท้องถิ่น:

```bash
npm install
npx prisma migrate dev
npm run dev
```

สคริปต์ที่เกี่ยวข้องใน `package.json`: `db:generate`, `db:migrate`, `db:seed`, `db:studio`

## Database migrations

- Production / staging: **`npx prisma migrate deploy`** (ไม่ใช้ `migrate dev` บน prod)
- Source of truth ของ schema: [`prisma/schema.prisma`](../../prisma/schema.prisma) — ดู [DATABASE.md](../DATABASE.md)
- ก่อน migrate: สำรอง DB ตาม [BACKUP.md](./BACKUP.md) และ checklist ใน rollout-runbook

## หลัง deploy — smoke ขั้นต่ำ

ย่อจาก [rollout-runbook](../architecture/rollout-runbook.md):

1. `/login` → dashboard `/`
2. `/machines` list / detail
3. `/maintenance/plans`, `/maintenance/schedules`
4. `/work-orders`
5. `/spare-parts`, `/settings/...`
6. `/notifications`, `/apps`
7. Cron (ถ้ามี): `GET /api/cron/generate-schedules` พร้อม `Authorization: Bearer $CRON_SECRET`
8. HR: `/hr/personnel`, `/hr/attendance` (ถ้าเปิดใช้)
9. Transport: `/transport/jobs`, `/transport/calendar`, `/transport/map` หรือ `/transport/monitor` (ต้องมี GPS env)
10. ยาง/ซ่อมรถ (ถ้าเปิดใช้): `/transport/tires`, `/transport/repairs`

## ไฟล์อัปโหลดบนเซิร์ฟเวอร์

ปัจจุบันอัปโหลดเขียนใต้ `public/uploads` และ `public/home-screen` — ต้องคงไดเรกทอรีเหล่านี้ระหว่างรีสตาร์ท/รีดีพลอย (volume หรือ sync) มิฉะนั้นรูปหาย

## Rollback

ดูขั้นตอน rollback ตามเฟสใน [rollout-runbook.md](../architecture/rollout-runbook.md) — โดยหลัก: revert commit + restore DB snapshot ถ้า migration ไม่ย้อนง่าย
