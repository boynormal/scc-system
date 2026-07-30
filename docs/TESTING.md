# Testing

มาตรฐานการทดสอบของโปรเจกต์นี้ — สอดคล้องกับ CI ใน [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

## คำสั่ง

```bash
npm test           # vitest run (CI ใช้คำสั่งนี้)
npm run test:watch # vitest watch ตอนพัฒนา
```

ก่อน push/PR ที่กระทบ logic หรือ permissions ควรรัน `npm test` ให้ผ่าน

## ชั้นที่คาดหวัง (ปัจจุบัน)

| ชั้น | สถานะ | ที่อยู่ตัวอย่าง |
|------|--------|----------------|
| Unit | ใช้เป็นหลัก | `modules/**/application/__tests__`, `lib/__tests__`, `shared/**/__tests__` |
| Integration / E2E | ยังไม่บังคับ | ยังไม่มี Playwright/Cypress ในมาตรฐานทีม |

โฟกัส unit ใกล้ application services, permissions, และ utils ที่ fragile

## เมื่อไหร่ควรเพิ่มหรือแก้ test

- เพิ่ม logic ธุรกิจใหม่หรือเปลี่ยนพฤติกรรมที่มีผลต่อข้อมูล/สถานะ
- แก้ RBAC / permission matrix / nav filtering
- แก้ utils ที่หลายโมดูลพึ่ง (วันที่ขนส่ง, WO number, upload profiles ฯลฯ)
- แก้ regression ที่เคยพัง — ใส่ regression test คู่กับการแก้

ไม่จำเป็นต้องมี test ใหม่ทุก UI-only change ถ้าไม่มี logic ที่แยกทดสอบได้ — แต่ต้องมี smoke ตามด้านล่าง

## CI ตรวจอะไร

ทุก PR ไป `main` รันตามลำดับ:

1. Lint (`npm run lint`)
2. Type check (`npx tsc --noEmit`)
3. Unit tests (`npm test`)
4. Build (`npm run build`) — หลัง job ข้างบนผ่าน

## Smoke ก่อน merge

นอกจาก CI ให้อ้างหลัก evidence ใน core workflow:

- Build/type/test ที่เกี่ยวข้องผ่าน
- ลอง flow ผู้ใช้ที่กระทบจริง (เช่น CRUD หน้า/API ที่แก้)
- ถ้าแตะ Prisma: migration + โน้ต backup/rollback (ดู [DATABASE.md](./DATABASE.md), [ops/BACKUP.md](./ops/BACKUP.md))
- ถ้าแตะ auth/API: ตรวจ session / permission / cron secret ตาม [SECURITY.md](./SECURITY.md)

## เอกสารที่เกี่ยวข้อง

- [agent-skills-adoption.md](./agent-skills-adoption.md)
- [SECURITY.md](./SECURITY.md)
- [ops/DEPLOYMENT.md](./ops/DEPLOYMENT.md)
