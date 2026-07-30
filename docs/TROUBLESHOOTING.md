# Troubleshooting

ปัญหาที่พบบ่อยและวิธีไล่ — อัปเดตเมื่อเจอเคสใหม่บน production/dev

## Auth / middleware

### Redirect หรือ HTML แทนรูปที่ `/uploads/...`

**สาเหตุ:** middleware เคยครอบ path อัปโหลด  
**แก้:** matcher ใน [`middleware.ts`](../middleware.ts) ยกเว้น `uploads/` และนามสกุลรูปแล้ว — ตรวจว่าไม่ได้เอา exception ออก

### Build/middleware error เรื่อง Prisma / bcrypt บน Edge

**สาเหตุ:** ลาก `lib/auth.ts` (Prisma) เข้า middleware  
**แก้:** middleware ต้อง import จาก [`lib/auth.config.ts`](../lib/auth.config.ts) เท่านั้น — ดู [SECURITY.md](./SECURITY.md)

## GPS / Transport

### แผนที่หรือมอนิเตอร์ว่าง / error

ตรวจ env ฝั่งเซิร์ฟเวอร์:

- `GPS_API_URL`
- `GPS_API_AUTH`
- `GPS_ASSET_ID`

แล้วลอง `/api/transport/gps` หลัง login — ดู [ops/DEPLOYMENT.md](./ops/DEPLOYMENT.md)

## Cron

### `401` จาก `/api/cron/*`

- ตั้ง `CRON_SECRET` ให้ตรงกับ header: `Authorization: Bearer <secret>`
- อย่าเรียก cron จากเบราว์เซอร์โดยไม่มี secret

## Database / migrate

### Schema ไม่ตรงโค้ด / คอลัมน์หาย

1. `npx prisma migrate status`
2. อย่าเพิ่มคอลัมน์ด้วย SQL มือโดยไม่เข้า Prisma
3. อ่าน [DATABASE.md](./DATABASE.md) และ [db-blueprint drift](./architecture/db-blueprint.md)

### Deploy Linux พังที่ migration encoding

เคยมีปัญหา encoding ของ baseline SQL — ใช้ migration ใน repo ปัจจุบัน; ถ้าต้องแก้ไฟล์ SQL ให้เข้ากับ UTF-8 บน Linux

## Upload / รูปไม่ขึ้น

1. ตรวจว่าไฟล์มีจริงใต้ `public/uploads` หรือ `public/home-screen`
2. หลัง redeploy: volume/ไฟล์ยังอยู่หรือไม่ (ดู [BACKUP.md](./ops/BACKUP.md))
3. สิทธิ์ home-screen icon ต้องมี `settings:update`
4. Network tab: ได้รูปหรือได้ HTML จาก redirect login

## ESLint

หลัง cleanup (2026-07-30, `2f24fff`) คำสั่ง `npm run lint` / ESLint ควรผ่านโดยไม่มี warning กลุ่ม unused / `no-img-element` (ยกเว้นจุดที่ disable สำหรับ blob) / `exhaustive-deps` ที่แก้แล้ว

ถ้าขึ้นใหม่: แก้ deps ให้ถูกต้อง หรือจับ ref ใน effect ตามแบบ Leaflet map — หลีกเลี่ยง disable ทั้งไฟล์โดยไม่จำเป็น

## หาเอกสารต่อ

| เรื่อง | เอกสาร |
|--------|--------|
| Deploy / smoke | [ops/DEPLOYMENT.md](./ops/DEPLOYMENT.md) |
| Backup | [ops/BACKUP.md](./ops/BACKUP.md) |
| Security | [SECURITY.md](./SECURITY.md) |
| Rollout ใหญ่ | [architecture/rollout-runbook.md](./architecture/rollout-runbook.md) |
| ประวัติฟีเจอร์ | [CHANGELOG.md](./CHANGELOG.md) |
