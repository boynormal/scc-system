# Module: `due_dates`

ศูนย์ติดตามวันครบกำหนด — รายการอิสระ ไม่ดึงหรือ FK ไป PM / เครื่องจักร / คนขับ

หน้า UI: `app/(dashboard)/due-dates/**`  
- `/due-dates` รายการ (การ์ด 5 สี + ตาราง)  
- `/due-dates/new` สร้าง  
- `/due-dates/[id]` รายละเอียด / ปิดงาน / เปิดใหม่ / ต่ออายุ  
- `/due-dates/[id]/edit` แก้ไข  

API: `app/api/due-dates/**` (thin adapter → application services)

วันที่ใช้ `startDate` + `endDate` — สถานะสีและการแจ้งคำนวณจากวันสิ้นสุด  
ต่ออายุ = กรอกช่วงวันที่ใหม่ (ไม่ทำซ้ำอัตโนมัติ)

สถานะเปิด (วันคงเหลือถึงวันสิ้นสุด):

| ระดับ | วันคงเหลือ |
|-------|------------|
| normal | > 60 |
| watch | 31–60 |
| approaching | 8–30 |
| urgent | 1–7 |
| expired | ≤ 0 |

แจ้งเตือน `due_item_upcoming` (ฟ้า–ส้ม) / `due_item_overdue` (แดง) จาก `generateDueItemNotifications` ที่ cron `/api/cron/notify` เรียก — ไม่แจ้งเขียว — โมดูล notifications ไม่ query ตารางนี้
