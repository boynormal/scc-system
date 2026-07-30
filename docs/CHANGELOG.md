# Changelog

บันทึก milestone สำคัญ (ไม่ mirror ทุก commit) — รูปแบบย่อแบบ Keep a Changelog

## [Unreleased]

### Changed

- Performance เฟส A: GPS lookup TTL cache 15s + poll 45s; SSR pagination (50) บน machines/spare-parts/plans/users; upload max 5MB ฝั่งเซิร์ฟเวอร์; index GPS/calendar; cron `notify` ใช้ `CRON_SECRET` + low-stock กรองใน SQL

## 2026-07-30

### Added

- Transport tire management: wheel count/layout บนประเภทรถ, บันทึกงานยาง, หน้า `/transport/tires`
- วิธีชำระเงิน cash/credit บนบันทึกซ่อมรถและงานยาง (เมื่อมีค่าใช้จ่าย)

### Fixed

- ESLint cleanup: unused imports, `next/image`, `react-hooks/exhaustive-deps` — lint ผ่านไม่มี warning (`2f24fff`)

## 2026-07

### Added

- Transport vehicle repair logs: workflow สถานะ, UI ปฏิทิน/การ์ด (`176a44c`)
- Home-screen icons (git-tracked), RBAC role matrix, glass UI, launcher weather (`c545cce`)
- Per-user module visibility override

### Fixed

- Category / product-line icons ไม่แสดง (middleware ยกเว้น uploads, ประมวลผล WebP)
- User management authorization gap และข้อมูลหลายสาขาหาย
- Baseline migration SQL encoding สำหรับ Linux deploy
- Machine PM schema drift (`pm_general` / `pm_major`) ปิดแล้ว 2026-07-23 — track ใน Prisma แล้ว

## หมายเหตุ

- ประวัติละเอียด: `git log`
- Known issues / วิธีแก้: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
