# Module: `raw_material_news`

ข่าวสารวัตถุดิบ (กระดาษ, เหล็ก, โลหะมีค่า, Ewaste) — หน้า UI ที่ `app/(dashboard)/raw-material-news/**`

## กระดาษ (`/raw-material-news/paper`)

ดึงข้อมูลสดตอนเปิดหน้าผ่าน `GET /api/raw-material-news/paper` (auth + `raw_material_news:read`)

| บล็อก | แหล่ง | Cache |
|-------|--------|--------|
| อัตราแลกเปลี่ยน USD/RMB ต่อบาท | [open.er-api.com](https://open.er-api.com/v6/latest/USD) + ประวัติ 30 วันจาก jsDelivr currency-api | 1 ชม. |
| ราคา/ดัชนี Wastepaper จีน | HTML สาธารณะ [Sunsirs prodetail-1254](https://www.sunsirs.com/uk/prodetail-1254.html) | 6 ชม. |
| กราฟ Wastepaper | รูปจาก [graph.100ppi.com id=1254](https://graph.100ppi.com/?w=900&h=420&c=p&id=1254&state=english) โหลดในเบราว์เซอร์ (`<img>`) | อัปเดตที่ต้นทาง |
| ค่าระวาง FBX02 | [WordPress REST](https://www.freightos.com/wp-json/wp/v2/pages?slug=fbx-02-north-america-west-coast-to-china) ของหน้า [Freightos FBX02](https://www.freightos.com/enterprise/terminal/fbx-02-north-america-west-coast-to-china/) — parse JSON ที่ฝังใน `content.rendered` | 6 ชม. |

Fetch timeout **30s** ต่อแหล่ง, route `maxDuration` 60s, `Promise.allSettled` — บล็อกที่พังไม่บล็อกบล็อกอื่น

## ข้อจำกัด

- กราฟแนวโน้มใช้รูปจาก 100PPI (`<img>` ฝั่งเบราว์เซอร์) ไม่ scrape และไม่ใช้ Recharts — ถ้าโหลดรูปไม่ได้ให้มี fallback + ลิงก์ต้นทาง
- หน้า Sunsirs สาธารณะให้ **spot price** ไม่ใช่ดัชนีดีมานด์แยก — ดัชนีราคาคำนวณจากชุดที่ดึงได้ (ฐาน 100 ที่จุดแรก)
- Freightos กราฟสมาชิก Terminal ดึงไม่ได้ — หน้านี้โชว์ Current FBX + Volatility + กราฟรายสัปดาห์สั้นจาก JSON ที่ฝังในหน้าสาธารณะ (WP REST) โครงสร้างเพจเปลี่ยนได้
- HTML ต้นทางเปลี่ยนโครงสร้างได้ — UI ต้องแสดง error + ลิงก์เปิดต้นทาง
- ยังไม่มีตาราง Prisma / CMS

ยังไม่มี application service สำหรับเหล็ก / โลหะมีค่า / Ewaste
