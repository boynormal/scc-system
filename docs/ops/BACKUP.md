# Backup / Restore

ขั้นตอนสำรองและกู้คืนสำหรับ production — ใช้คู่กับ [DEPLOYMENT.md](./DEPLOYMENT.md) และ checklist ใน [rollout-runbook](../architecture/rollout-runbook.md)

## เมื่อไหร่ควร backup

- ก่อน `prisma migrate deploy` ทุกครั้งบน production
- ก่อน rollout ใหญ่ (โครงสร้างโมดูล / schema)
- ตามรอบประจำ (รายวัน/รายสัปดาห์ ตามนโยบายทีม)

## 1) Database (PostgreSQL)

### Dump

```bash
pg_dump -Fc -f scc-backup-$(date +%Y%m%d).dump "$DATABASE_URL"
```

หรือใช้ snapshot ของ managed host (Neon / Supabase / VM disk) ถ้ามี

### Restore

```bash
# ระวัง: ทับข้อมูลปลายทาง
pg_restore -d "$DATABASE_URL" --clean --if-exists scc-backup-YYYYMMDD.dump
```

หลัง restore:

```bash
npx prisma generate
# ตรวจว่า migration history สอดคล้อง DB จริง
npx prisma migrate status
```

## 2) ไฟล์อัปโหลด

แยกจาก DB:

| ที่อยู่ | เนื้อหา |
|--------|---------|
| `public/uploads/` | รูป/ไฟล์ runtime (เครื่องจักร, อะไหล่ ฯลฯ) |
| `public/home-screen/` | ไอคอน home-screen ที่อัปโหลด/track |

สำรองด้วย `rsync` / archive / volume snapshot ของไดเรกทอรีเหล่านี้พร้อมกับ dump DB

ถ้าใช้ object storage (`STORAGE_*`) ในอนาคต — สำรอง bucket แยกต่างหาก

## 3) สิ่งที่ไม่ควร backup เข้า git

- `.env` / secrets
- `node_modules`
- `.next`

## Restore smoke

หลังกู้คืนแล้วตรวจอย่างน้อย:

1. Login ได้
2. รายการ machines / branches อ่านได้
3. รูปจาก `/uploads/...` โหลดได้ (ถ้ามีข้อมูลเดิม)
4. โมดูลหลักตาม [DEPLOYMENT.md](./DEPLOYMENT.md) smoke list
