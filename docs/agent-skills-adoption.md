# Agent Skills Adoption (Project-specific)

แหล่งอ้างอิง: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)

เอกสารนี้สรุปแนวทางนำ Agent Skills มาใช้ในโปรเจกต์นี้แบบเหมาะสม (ไม่ยัดทุกอย่างพร้อมกัน)

## รูปแบบที่เลือก

- ใช้แบบ **Hybrid**
  - กฎหลักใช้ทุก session
  - กฎเฉพาะไฟล์ใช้เมื่อแก้ frontend / API / Prisma / security / module boundaries
- **Policy** อยู่ใน `docs/*` — **Enforcement** อยู่ใน `.cursor/rules/*.mdc` (สั้น ชี้ docs ไม่คัดลอกทั้งบท)

## Rule Files ที่ติดตั้ง

- `.cursor/rules/agent-skills-core-workflow.mdc` (alwaysApply)
- `.cursor/rules/agent-skills-frontend-ui.mdc` (`**/*.tsx`)
- `.cursor/rules/agent-skills-api-and-data.mdc` (`app/api/**/*.ts`)
- `.cursor/rules/agent-skills-prisma.mdc` (`prisma/**`)
- `.cursor/rules/agent-skills-security.mdc` (`app/api/**/*.ts`, `lib/**/*.ts`, `middleware.ts`)
- `.cursor/rules/agent-skills-module-boundaries.mdc` (`modules/**/*.ts`, `app/api/**/*.ts`)

## สิ่งที่ได้ทันที

- Workflow งานชัด: Spec -> Plan -> Build -> Verify -> Review -> Ship
- ลดโอกาส regression จากการแก้เร็วโดยไม่มี evidence
- ย้ำเรื่อง compatibility, fallback UI, และ API contract
- วินัย schema/migration + backup ก่อน deploy
- ขอบเขตความปลอดภัย (auth, RBAC, secrets, upload, cron)
- ขอบเขตโมดูล / thin API adapter ตาม core-platform-convention
- มาตรฐานทดสอบใน [TESTING.md](./TESTING.md) และ checklist ใน `.github/pull_request_template.md`
- รูปแบบ API as-is + เป้าโค้ดใหม่ใน [API.md](./API.md)
- Ops checklist ใน [ops/MONITORING.md](./ops/MONITORING.md)
- UI states: `LoadingState` / `ErrorState` / `EmptyState` + `fetchJson` (`lib/client-fetch.ts`) — ต้นแบบที่หน้า transport repairs/tires
- i18n foundation: `next-intl` + cookie `scc_locale` + [I18N.md](./I18N.md) (th/en, ไม่มี URL prefix)

## เฟส A (เสร็จแล้ว)

1. Prisma rule (`prisma/**`)
2. Security rule (API / lib / middleware)
3. [TESTING.md](./TESTING.md)
4. PR template (`.github/pull_request_template.md`)

## เฟส B (เสร็จแล้ว)

1. Module-boundary rule — [architecture/core-platform-convention.md](./architecture/core-platform-convention.md)
2. ขยาย [API.md](./API.md) (error / success / pagination as-is + เป้าโค้ดใหม่)
3. [ops/MONITORING.md](./ops/MONITORING.md)

## ถัดไป (ยังไม่ทำในรอบนี้)

1. IaC เบา — Dockerfile + docker-compose เมื่อพร้อม staging/production
2. AI/OCR rules เมื่อมีโมดูลจริง
3. APM / health endpoint เมื่อมีเจ้าของ ops ชัด (ดู MONITORING.md สิ่งที่ยังไม่มี)
4. แปลหน้า deferred (machines / maintenance / work-orders / HR / spare-parts) เมื่อโมดูลเสร็จ — ดูสถานะใน [I18N.md](./I18N.md)
5. ไล่รายละเอียดฟอร์ม/ตารางใน transport+settings ที่ยัง hardcode

## การทบทวน

ทบทวนทุก 2–4 สัปดาห์ว่า rule ไหนเข้มเกินหรืออ่อนไป แล้วปรับก่อนเริ่มงานถัดไป
