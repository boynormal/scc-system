# Database

## Source of truth

**Schema จริงอยู่ที่ [`prisma/schema.prisma`](../prisma/schema.prisma) เท่านั้น**

อย่าคัดลอกตารางคอลัมน์ทั้งก้อนมาใส่เอกสาร — เมื่อ schema เปลี่ยน ให้ migrate ผ่าน Prisma แล้วอัปเดต blueprint เฉพาะจุดที่เกี่ยวกับนโยบาย/ดัชนี

## เอกสารอ้างอิง

| เอกสาร | เนื้อหา |
|--------|---------|
| [architecture/db-blueprint.md](./architecture/db-blueprint.md) | กลุ่มตารางตามโมดูล, unique/index, drift ที่ปิดแล้ว |
| Migrations | `prisma/migrations/` |

## หลักการสั้นๆ

- Primary key เป็น UUID
- Multi-tenant ผ่าน `company` / `branch`
- Soft delete ด้วย `deletedAt` / `deleted_at` ตามที่ schema กำหนดในแต่ละโมเดล
- สถานะ/ชนิดสำคัญใช้ enum ของ Prisma / PostgreSQL เมื่อเป็นไปได้
- JSONB สำหรับค่าที่ยืดหยุ่น (เช่น permissions, settings)

## คำสั่งที่ใช้บ่อย

```bash
npx prisma generate
npx prisma migrate dev      # local
npx prisma migrate deploy  # staging/production
npx prisma migrate status
npm run db:studio
```

ก่อน migrate บน production: [ops/BACKUP.md](./ops/BACKUP.md)

## Schema drift

ประวัติ drift ของ `machines.pm_general` / `pm_major` (ปิดแล้ว 2026-07-23) อยู่ที่ [db-blueprint § drift](./architecture/db-blueprint.md) — อย่าเพิ่มคอลัมน์นอก Prisma อีก
