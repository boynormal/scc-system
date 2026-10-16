# SeaweedFS S3

ใบแนบค่าใช้จ่ายใหม่เก็บไบต์ใน SeaweedFS และเก็บ metadata ในตาราง `stored_files` รูปและไฟล์เก่าใน `public/uploads` ไม่ถูกย้าย

## ตัวแปร

ตั้งใน `.env` ของโปรเซส ERP เท่านั้น ห้ามใส่ใน `NEXT_PUBLIC_*` และห้าม commit ค่าจริง

| ตัวแปร | ความหมาย |
|--------|----------|
| `S3_ENDPOINT` | URL ของ S3 API |
| `S3_REGION` | ค่าที่ SeaweedFS ใช้ เช่น `us-east-1` |
| `S3_BUCKET` | ชื่อ bucket เช่น `erp` |
| `S3_ACCESS_KEY_ID` | access key ของ identity สำหรับ ERP |
| `S3_SECRET_ACCESS_KEY` | secret ของ identity นั้น |
| `S3_FORCE_PATH_STYLE` | `true` สำหรับ SeaweedFS |
| `S3_REQUEST_TIMEOUT_MS` | timeout ต่อคำขอ ค่าเริ่มต้น 30000 |
| `S3_MAX_UPLOAD_BYTES` | ขนาดไฟล์ใบแนบ ค่าเริ่มต้น 10485760 (10MB) สูงสุด 20MB |

`STORAGE_*` ใน `.env.example` เป็นโครงเก่าที่โค้ดไม่ได้ใช้

ตัวอย่างต่อสภาพแวดล้อม:

- แอปและ SeaweedFS อยู่เครื่องเดียวกัน: `http://127.0.0.1:8333`
- แอปอยู่ใน Docker คนละเครือข่ายกับ SeaweedFS: `http://<ชื่อ service>:8333` ไม่ใช้ `127.0.0.1` เพราะ loopback คือตัวคอนเทนเนอร์เอง
- เซิร์ฟเวอร์นี้: `https://s3.scharoenchai.cloud` เฉพาะเมื่อโปรเซส ERP เรียกแล้วได้คำตอบ S3 จริง ไม่ใช่หน้า HTML ของ Cloudflare

`http://` ใช้ได้เฉพาะ host ส่วนตัว (`localhost`, IP ส่วนตัว, ชื่อที่ไม่มีจุด, `*.local`, `*.internal`) host สาธารณะต้องเป็น `https://`

## สิทธิ์ใน SeaweedFS

สร้าง identity แยกสำหรับ ERP ใน `s3.json` ให้ Read, Write, List เฉพาะ bucket `erp` ไม่ใช้ `erp-admin` ในแอป

หมุน credential โดยสร้าง key ใหม่ให้อัปเดต `.env` แล้วรีสตาร์ทโปรเซส ERP จากนั้นปิด key เก่า อย่าใส่ key ลงคำสั่งที่ถูกเก็บใน history ถ้าเลี่ยงได้ — ใช้ environment หรือไฟล์ที่ไม่อยู่ใน git

พอร์ต 8333 ไม่ควรเปิดตรงสู่อินเทอร์เน็ต ให้ผ่านเครือข่ายส่วนตัวหรือ reverse proxy

## ตรวจว่า ERP ถึง S3 ได้

รันบนเครื่องเดียวกับโปรเซส ERP ไม่ใช่แค่จากเครื่องที่เปิดเบราว์เซอร์:

```powershell
npx tsx scripts/check-s3-reachability.ts
```

สคริปต์อ่าน `.env` แล้วทำ `head-bucket`, อัปโหลดไฟล์ใต้ `health-check/`, ดาวน์โหลดเทียบ SHA-256 แล้วลบเฉพาะไฟล์ที่ตัวเองสร้าง มันไม่พิมพ์ access key

ถ้าได้หน้า HTML "Attention Required" ของ Cloudflare แปลว่า WAF บล็อกก่อนถึง SeaweedFS ต้องเลือกอย่างใดอย่างหนึ่งก่อนเปิดใช้จริง:

- ให้ ERP เรียกที่อยู่ภายในที่ไม่ผ่าน Cloudflare หรือ
- ตั้ง WAF Skip สำหรับ hostname นี้ โดยจำกัดตาม IP ขาออกของเครื่อง ERP

ตรวจเมื่อ 16 ต.ค. 2026 จากเครื่องพัฒนา: คำขอแบบไม่ใช้ credential ไป `https://s3.scharoenchai.cloud` ได้ 403 เป็นหน้า Cloudflare ไม่ใช่ XML ของ S3 และ `.env` ยังไม่มี `S3_*` ดังนั้นรอบนี้ยังไม่ยืนยันการเขียนอ่าน bucket `erp` ด้วย credential

## พฤติกรรมในแอป

- อัปโหลดใบเสร็จ: `POST /api/finance/expenses/{id}/files` ต้องล็อกอินและมี `expenses:update` ในสาขาของบิล
- ดาวน์โหลด: `GET /api/finance/expenses/{id}/attachments/{attachmentId}/file` ตรวจ `expenses:read` ทุกครั้ง แล้วสตรีมผ่านเซิร์ฟเวอร์ ไม่มี presigned URL
- ลบในแอปเป็นการตัดลิงก์และตั้ง `stored_files.deleted_at` อ็อบเจ็กต์ใน SeaweedFS ยังอยู่
- ชนิดที่รับ: PDF, JPEG, PNG, WebP ตรวจจากเนื้อไฟล์ ไฟล์เก่าที่ชี้ `/uploads/...` ยังเปิดได้

## สิ่งที่ยังไม่ตรวจ

- การกู้คืนจาก backup ของ SeaweedFS ยังไม่ถือว่าเสร็จจนกว่าจะ restore แล้วเปิดไฟล์ได้
- การเข้ารหัสที่ rest ของ volume
- worker เก็บกวาดอ็อบเจ็กต์ที่อัปโหลดสำเร็จแต่บันทึก metadata ไม่สำเร็จ ตอนนี้โค้ดพยายามลบอ็อบเจ็กต์นั้นทันที และ log `fileId` ถ้าลบไม่สำเร็จ
- โมดูลอื่นยังไม่อัปโหลดผ่านชั้นนี้
