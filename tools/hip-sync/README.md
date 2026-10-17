# HIP Sync — โปรแกรมซิงค์ข้อมูลสแกนนิ้วของสาขา

อ่านข้อมูลสแกนนิ้วจากไฟล์ `Pm2014.mdb` ของ HIP PremiumTime บนเครื่องสาขา แล้วส่งเข้าระบบ SCC (`/api/device-sync/hip/*`)
ฝ่าย HR ดูและผูก badge กับพนักงานได้ที่หน้าเว็บ **HR > บันทึกเวลา**

- Windows 7 SP1 ขึ้นไป + .NET Framework 4.8 (Windows 10/11 มีอยู่แล้ว)
- โปรแกรม 32 บิต (x86) ใช้ไดรเวอร์ Jet 4.0 ที่มากับ Windows — ถ้าไม่มีจะลอง Access Database Engine (ACE 12/16) 32 บิต
- ไม่ต้องใช้สิทธิ์ admin ในการติดตั้งหรือใช้งาน

## 1. สร้าง Device API key (ผู้ดูแลระบบ ทำบนเว็บ)

1. เข้าเว็บ SCC > **HR > บันทึกเวลา** > แท็บ **เครื่องสแกน**
2. กด **เพิ่มเครื่องสแกน** ให้สาขานั้น (1 ไฟล์ Pm2014.mdb = 1 เครื่อง) แล้วกด **สร้างและออก API key**
3. คัดลอก key (ขึ้นต้นด้วย `hip_`) — **แสดงครั้งเดียว** ถ้าหายให้กด **ออก key ใหม่** (key เดิมจะใช้ไม่ได้ทันที)

## 2. ติดตั้งที่เครื่องสาขา

1. รัน `HipSync-Setup-<version>.exe` (ติดตั้งไปที่ `%LOCALAPPDATA%\Programs\HipSync` พร้อมไอคอนบน Desktop และ Start Menu)
2. เปิดโปรแกรมครั้งแรกจะเข้าหน้าตั้งค่าอัตโนมัติ

## 3. ตั้งค่า

| ช่อง | ค่า |
| --- | --- |
| ไฟล์ Pm2014.mdb | กด **ค้นหาอัตโนมัติ** (ปกติ `C:\Program Files (x86)\HIP PremiumTime 2.0.6\db\Pm2014.mdb`) |
| รหัสผ่านไฟล์ | ค่าเริ่มต้นของ HIP คือ `hippmforyou` |
| URL เซิร์ฟเวอร์ | URL ของระบบ SCC เช่น `https://scc.example.com` (ใช้ `https://` เมื่อส่งข้ามเครือข่าย) |
| Device API key | key จากข้อ 1 |

กด **ทดสอบเปิดไฟล์** และ **ทดสอบการเชื่อมต่อ** ให้ขึ้น ✓ ทั้งคู่ แล้วกด **บันทึก**

ตัวเลือกเพิ่มเติม: ซิงค์อัตโนมัติเมื่อเปิดโปรแกรม, จำนวนแถวต่อรอบส่ง (สูงสุด 2,000), PIN ผู้ดูแลก่อนเข้าหน้าตั้งค่า

ค่าที่บันทึกอยู่ที่ `%APPDATA%\HipSync\settings.json` — รหัสผ่านไฟล์และ key ถูกเข้ารหัสด้วย Windows DPAPI
(ถอดได้เฉพาะ Windows user เดิมบนเครื่องเดิม ถ้าย้ายเครื่องหรือเปลี่ยน user ต้องใส่ key ใหม่)

## 4. การใช้งาน

กด **ซิงค์ข้อมูล** — โปรแกรมจะถามเซิร์ฟเวอร์ว่าส่งถึงแถวไหนแล้ว และส่งเฉพาะแถวใหม่
กดซ้ำหรือเน็ตหลุดกลางทางได้ ไม่มีข้อมูลซ้ำหรือหาย (กดใหม่จะทำต่อจากจุดเดิม)

ถ้าผลแสดง **badge ยังไม่ผูก** ให้แจ้ง HR ไปผูก badge กับพนักงานที่หน้าเว็บ — เวลาสแกนของ badge นั้นจะถูกนับย้อนหลังให้เมื่อผูกแล้ว

### ซิงค์อัตโนมัติด้วย Task Scheduler (ไม่บังคับ)

`HipSync.exe --sync` ซิงค์ด้วยค่าที่บันทึกไว้โดยไม่เปิดหน้าต่าง (exit code 0 = สำเร็จ, 1 = ผิดพลาด, 2 = ยังไม่ได้ตั้งค่า)
ตั้ง task ให้รันด้วย **Windows user เดียวกับที่ตั้งค่า** (เพราะ DPAPI) เช่นทุก 30 นาที:

```bat
schtasks /Create /SC MINUTE /MO 30 /TN "HIP Sync" /TR "\"%LOCALAPPDATA%\Programs\HipSync\HipSync.exe\" --sync"
```

## 5. แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
| --- | --- |
| ไม่พบไฟล์ฐานข้อมูล HIP | ตรวจที่อยู่ไฟล์ในหน้าตั้งค่า หรือกด ค้นหาอัตโนมัติ |
| รหัสผ่านไฟล์ไม่ถูกต้อง | ตรวจรหัสผ่านในหน้าตั้งค่า (ค่าเริ่มต้น `hippmforyou`) |
| คัดลอกไฟล์ฐานข้อมูลไม่ได้ | โปรแกรม HIP ล็อกไฟล์อยู่ — ปิด HIP แล้วซิงค์ใหม่ |
| ไม่มีไดรเวอร์อ่านไฟล์ Access | ติดตั้ง Microsoft Access Database Engine 2010 **32-bit** |
| เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ / timeout | ตรวจอินเทอร์เน็ตและ URL |
| Device API key ไม่ถูกต้อง หรือถูกยกเลิก | key ถูกออกใหม่หรือเครื่องถูกปิดใช้งานบนเว็บ — ขอ key ใหม่ |
| ไม่พบ API ซิงค์ที่ URL นี้ | URL ผิด (เช่นลืม `https://` หรือใส่ path เกิน) |
| เซิร์ฟเวอร์ไม่รับข้อมูล | ข้อมูลบางแถวผิดรูปแบบ — ส่ง log ให้ผู้ดูแลระบบ |
| เวลาสแกนคลาดเคลื่อนเป็นชั่วโมง | ตั้ง Time zone ของ Windows เครื่องสาขาให้ตรงกับสาขา (หน้าทดสอบการเชื่อมต่อแสดงทั้งสองค่า) |

Log อยู่ที่ `%APPDATA%\HipSync\logs\yyyy-MM-dd.log` (ปุ่ม **เปิดโฟลเดอร์ log**) เก็บย้อนหลัง 60 วัน

## สำหรับนักพัฒนา

- โค้ด: `HipSync/` (C# WinForms, .NET Framework 4.8, x86, ไม่มี DLL ภายนอก)
  - `Core/MdbReader.cs` — copy mdb ไป `%TEMP%` แล้วอ่าน `CHECKINOUT` / `USERINFO` ด้วย OleDb
  - `Core/SyncApiClient.cs` — `GET /api/device-sync/hip/state`, `POST /api/device-sync/hip/batch`
  - `Core/SyncService.cs` — ต่อจาก `lastSourceRowId` ของเซิร์ฟเวอร์ ส่งทีละ batch
- Build (เครื่อง dev ต้องมี .NET SDK 8 และ Inno Setup 6): `powershell -ExecutionPolicy Bypass -File build.ps1`
  → `HipSync\bin\Release\net48\HipSync.exe` และ `dist\HipSync-Setup-<version>.exe`
- ออกเวอร์ชันใหม่: แก้ `<Version>` ใน `HipSync/HipSync.csproj` แล้ว build; ตั้ง `HIP_SYNC_LATEST_VERSION` บนเซิร์ฟเวอร์ให้โปรแกรมรุ่นเก่าขึ้นแจ้งเตือน
- ทดสอบ end-to-end กับเซิร์ฟเวอร์ dev: `npx tsx scripts/hip-sync-client-e2e.ts <HipSync.exe> <Pm2014.mdb> [baseUrl]`
- `make-icon.ps1` สร้าง `HipSync/app.ico` ใหม่
