# Deploy: บันทึกเวลาจาก HIP PremiumTime

Checklist สำหรับขึ้น production ของสอง migration นี้ ทำบนเซิร์ฟเวอร์เอง — เอกสารนี้ไม่ใช่สคริปต์ deploy

- `20261017130000_hip_attendance_redesign` — ลบตารางนำเข้า Excel (`attendance_entries`, `attendance_import_batches`) แล้วสร้างเครื่องสแกน / badge / punches / สรุปรายวัน
- `20261017145000_drop_duty_catalog` — ลบสมุดหน้าที่ และข้อความ `positions.responsibilities`, `personnel_positions.extra_duties`
- `20261017170000_drop_positions` — ลบตาราง `positions`, `personnel_positions` และคอลัมน์ `personnel.position_id` ถาวร สำรองฐานข้อมูลก่อน deploy เพราะ rollback จาก migration นี้ไม่ได้

ทั้งสามลบข้อมูลเดิมทิ้ง การ rollback ต้อง restore จาก dump

ดูวิธี deploy ทั่วไปที่ [DEPLOYMENT.md](./DEPLOYMENT.md) และวิธี dump ที่ [BACKUP.md](./BACKUP.md)

## 1. ตรวจก่อน deploy

บน production:

```bash
npx prisma migrate status
```

ต้องมีแค่สอง migration ด้านบนที่ยังไม่ applied ถ้ามีรายการอื่นค้าง ให้หยุดและตรวจก่อน

นับข้อมูลที่จะถูกลบ ถ้ามีแถวที่ต้องเก็บ ให้ export เป็น CSV ก่อน migrate:

```sql
SELECT 'attendance_entries' AS t, count(*) FROM attendance_entries
UNION ALL SELECT 'attendance_import_batches', count(*) FROM attendance_import_batches
UNION ALL SELECT 'duty_categories', count(*) FROM duty_categories
UNION ALL SELECT 'duty_items', count(*) FROM duty_items
UNION ALL SELECT 'position_duty_items', count(*) FROM position_duty_items
UNION ALL SELECT 'personnel_position_duty_items', count(*) FROM personnel_position_duty_items
UNION ALL SELECT 'positions.responsibilities', count(*) FROM positions WHERE responsibilities IS NOT NULL AND btrim(responsibilities) <> ''
UNION ALL SELECT 'personnel_positions.extra_duties', count(*) FROM personnel_positions WHERE extra_duties IS NOT NULL AND btrim(extra_duties) <> '';
```

## 2. สำรอง

```bash
pg_dump -Fc -f scc-backup-before-hip-attendance.dump "$DATABASE_URL"
```

เก็บไฟล์ dump ไว้นอกเครื่องที่ deploy และตรวจว่าไฟล์ไม่ว่างก่อนขั้นถัดไป

## 3. Deploy

```bash
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

แล้วรีสตาร์ทโปรเซส (`npm start` หรือตัวจัดการโปรเซสที่ใช้จริง)

## 4. ค่าที่ต้องตั้ง

- เสิร์ฟเว็บด้วย `https://` และให้สาขาเข้าถึง URL นั้นได้ โปรแกรมสาขาจะเตือนถ้าใส่ `http://` ที่ไม่ใช่ localhost
- ไม่บังคับ: `HIP_SYNC_LATEST_VERSION=1.0.0` เพื่อให้โปรแกรมสาขารุ่นเก่าขึ้นข้อความว่ามีรุ่นใหม่

## 5. Smoke

1. ล็อกอินแล้วเปิด `/hr/attendance` และ `/hr/personnel`
2. `/hr/duties`, `/hr/org` และ `/hr/positions` ต้อง 404
3. ไม่มี key:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer hip_bad" "$NEXTAUTH_URL/api/device-sync/hip/state"
```

ต้องได้ `401`

## 6. ติดตั้งที่สาขา

ตัวติดตั้งไม่ได้เก็บใน git สร้างบนเครื่อง Windows ที่มี .NET SDK 8 และ Inno Setup 6:

```powershell
powershell -ExecutionPolicy Bypass -File tools/hip-sync/build.ps1
```

ได้ `tools/hip-sync/dist/HipSync-Setup-1.0.0.exe`

ที่แต่ละสาขา:

1. บนเว็บ: HR > บันทึกเวลา > แท็บเครื่องสแกน — เพิ่มหนึ่งเครื่องต่อหนึ่งไฟล์ `Pm2014.mdb` แล้วคัดลอก API key (แสดงครั้งเดียว)
2. ติดตั้ง `HipSync-Setup-1.0.0.exe` ตั้งไฟล์ mdb, รหัสผ่านไฟล์, URL `https://` ของเซิร์ฟเวอร์, และ key
3. กดซิงค์สองครั้ง ครั้งที่สองต้องได้ 0 แถวใหม่
4. ผูก badge กับพนักงานที่แท็บผูกเลขสแกน

รายละเอียดโปรแกรมอยู่ที่ [tools/hip-sync/README.md](../../tools/hip-sync/README.md)

## 7. Rollback

1. revert commit ที่ deploy แล้ว build ใหม่
2. คืนฐานข้อมูลจาก dump ในข้อ 2:

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists scc-backup-before-hip-attendance.dump
npx prisma migrate status
```

หมายเหตุ rollback ในหัวไฟล์ migration อธิบายทางเลือกเพิ่ม (สร้างตารางเก่าจาก dump เฉพาะตาราง) dump ทั้งก้อนในข้อ 2 ครอบคลุมทั้งสอง migration
