# Agent Skills Adoption (Project-specific)

แหล่งอ้างอิง: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)

เอกสารนี้สรุปแนวทางนำ Agent Skills มาใช้ในโปรเจกต์นี้แบบเหมาะสม (ไม่ยัดทุกอย่างพร้อมกัน)

## รูปแบบที่เลือก

- ใช้แบบ **Hybrid**
  - กฎหลักใช้ทุก session
  - กฎเฉพาะไฟล์ใช้เมื่อแก้ frontend/API

## Rule Files ที่ติดตั้ง

- `.cursor/rules/agent-skills-core-workflow.mdc` (alwaysApply)
- `.cursor/rules/agent-skills-frontend-ui.mdc` (`**/*.tsx`)
- `.cursor/rules/agent-skills-api-and-data.mdc` (`app/api/**/*.ts`)

## สิ่งที่ได้ทันที

- Workflow งานชัด: Spec -> Plan -> Build -> Verify -> Review -> Ship
- ลดโอกาส regression จากการแก้เร็วโดยไม่มี evidence
- ย้ำเรื่อง compatibility, fallback UI, และ API contract

## ขั้นตอนถัดไป (แนะนำ)

1. เพิ่ม rule เฉพาะ migration (`prisma/**`) หากทีมแก้ schema บ่อย
2. เพิ่ม checklist release ใน PR template ให้สอดคล้องกับ core workflow
3. ทบทวนทุก 2-4 สัปดาห์ว่า rule ไหนเข้มเกินหรืออ่อนไป
