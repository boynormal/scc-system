# Monitoring (ops checklist)

Checklist ปฏิบัติการหลัง deploy / ตามรอบ — **ยังไม่**ติดตั้ง APM (Sentry ฯลฯ) หรือ health endpoint กลางในรอบนี้

ดูคู่กับ: [DEPLOYMENT.md](./DEPLOYMENT.md), [BACKUP.md](./BACKUP.md), [TROUBLESHOOTING.md](../TROUBLESHOOTING.md), [architecture/rollout-runbook.md](../architecture/rollout-runbook.md)

## หลังทุก deploy

- [ ] Process / app logs ไม่มี error พุ่งผิดปกติ
- [ ] Smoke ขั้นต่ำตาม [DEPLOYMENT.md](./DEPLOYMENT.md) (login → โมดูลหลักที่เปิดใช้)
- [ ] ถ้ามี migration: `npx prisma migrate status` ตรงกับที่คาด; ไม่มี DB connection error ใน log
- [ ] ไดเรกทอรีอัปโหลดยังอยู่หลัง restart: `public/uploads`, `public/home-screen` (volume/sync)

## Auth และ cron

- [ ] `/login` สำเร็จด้วยบัญชีทดสอบ
- [ ] API ที่ต้อง session คืน 401 เมื่อไม่มีคุกกี้/session
- [ ] ถ้าเปิด cron: ตั้ง `CRON_SECRET`; เรียกด้วย Bearer ที่ถูกได้ผล; secret ผิด → 401
- [ ] ตัวอย่าง: `GET /api/cron/generate-schedules` และ/หรือ `/api/cron/notify`

## บริการภายนอก (ถ้าเปิดใช้)

- [ ] GPS: env `GPS_API_URL` / `GPS_API_AUTH` / `GPS_ASSET_ID` ครบ; `/api/transport/gps` ไม่ 503 จาก config หาย — ดู [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- [ ] Email (Resend): ถ้าใช้แจ้งเตือน — key ใช้ได้และไม่รั่วใน client

## CI และคุณภาพ

- [ ] Pipeline บน `main` เขียว: lint, typecheck, unit test, build (`.github/workflows/ci.yml`)
- [ ] หลังแก้ logic/permissions: `npm test` ผ่านก่อน merge (ดู [TESTING.md](../TESTING.md))

## Backup

- [ ] มีรอบสำรอง DB ตามนโยบายทีม
- [ ] สำรองก่อน `prisma migrate deploy` บน production — [BACKUP.md](./BACKUP.md)

## สิ่งที่ยังไม่มีใน repo (ติดตามภายหลัง)

เมื่อมี staging/production จริงและมีเจ้าของ ops ชัด ค่อยพิจารณา:

- APM / error tracking (เช่น Sentry)
- Health/readiness endpoint กลาง
- Metrics / uptime dashboard
- Log aggregation นอกเครื่องเดียว

อย่าสมมติว่ามี tooling เหล่านี้ตอน debug — ใช้ process log + checklist นี้ก่อน
