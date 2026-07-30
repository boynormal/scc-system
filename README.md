# Machine Maintenance System — Enterprise Edition

> **Tech stack:** Next.js 15 (App Router) + PostgreSQL + Prisma 6 + Auth.js  
> **Last updated:** 2026-07-30  
> เวอร์ชันแพ็กเกจดูที่ `package.json` / `package-lock.json`

ระบบซ่อมบำรุงเครื่องจักรแบบ multi-tenant พร้อมโมดูลที่เกี่ยวข้อง (งานสั่งซ่อม, อะไหล่, HR, ขนส่ง/GPS/ยาง ฯลฯ) ในรูปแบบ **modular monolith**

---

## Design principles

| หลักการ | รายละเอียด |
|---------|-----------|
| **Multi-Tenant** | หลายบริษัท / หลายสาขา |
| **RBAC** | สิทธิ์ระดับ branch |
| **Soft Delete** | ไม่ทำลายประวัติเมื่อลบ |
| **Audit / events** | ติดตามการเปลี่ยนแปลงตามที่โมดูลกำหนด |
| **Modular** | `modules/` + `shared/` + thin `app/` routes |

รายละเอียดสถาปัตยกรรม: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Quick start

```bash
npm install
cp .env.example .env   # ตั้ง DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
npx prisma migrate dev
npm run dev
```

Production-oriented steps: [docs/ops/DEPLOYMENT.md](docs/ops/DEPLOYMENT.md)

---

## Documentation

| เอกสาร | รายละเอียด |
|--------|-----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | แผนที่สถาปัตยกรรม + ลิงก์ blueprint |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema source of truth (Prisma) + db-blueprint |
| [docs/API.md](docs/API.md) | API convention + กลุ่ม endpoint |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth, RBAC, secrets, cron, upload |
| [docs/ops/DEPLOYMENT.md](docs/ops/DEPLOYMENT.md) | ติดตั้ง / build / smoke |
| [docs/ops/BACKUP.md](docs/ops/BACKUP.md) | Backup / restore |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | ปัญหาที่พบบ่อย |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | ประวัติ milestone |

### Architecture รายละเอียด

- [docs/architecture/vision-as-is-to-be.md](docs/architecture/vision-as-is-to-be.md)
- [docs/architecture/modular-folder-blueprint.md](docs/architecture/modular-folder-blueprint.md)
- [docs/architecture/core-platform-convention.md](docs/architecture/core-platform-convention.md)
- [docs/architecture/contributing-modules.md](docs/architecture/contributing-modules.md)
- [docs/architecture/db-blueprint.md](docs/architecture/db-blueprint.md)
- [docs/architecture/rollout-runbook.md](docs/architecture/rollout-runbook.md)

### คู่มือผู้ใช้ (โดเมน)

- [Usage.md](Usage.md) — Maintenance / Work Orders
- [Logistics.md](Logistics.md) — ขนส่ง
- [Logisticsgps.md](Logisticsgps.md) — GPS
- `modules/*/README.md` — ขอบเขตต่อโมดูล

---

## Tech stack (สรุป)

| ชั้น | เทคโนโลยี |
|------|-----------|
| App | Next.js 15, React 19, TypeScript, Tailwind, Radix |
| Data | PostgreSQL, Prisma 6 |
| Auth | Auth.js (NextAuth v5), bcryptjs |
| Client state | TanStack Query, Zustand (ตามจุดที่ใช้) |

Environment ตัวอย่าง: [`.env.example`](.env.example)

---

## Navigation

เมนูหลายโมดูลอยู่ที่ `shared/navigation/moduleRegistry.ts` (pipeline `buildDashboardNav`, `/apps` launcher, command palette) — ตั้งค่าต่อบริษัทผ่าน nav preferences API

---

## Scripts ที่ใช้บ่อย

| คำสั่ง | หน้าที่ |
|--------|--------|
| `npm run dev` | พัฒนา |
| `npm run build` / `npm start` | production |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:seed` | seed |
| `npm run db:studio` | Prisma Studio |

---

## Known caveats

ดูรายการล่าสุดและการแก้ปัญหาที่ [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) และ milestone ที่ [docs/CHANGELOG.md](docs/CHANGELOG.md)
