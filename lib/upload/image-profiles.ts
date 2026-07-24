import sharp from "sharp"

/**
 * โปรไฟล์การประมวลผลรูปตอนอัปโหลด — ใช้ร่วมกับ POST /api/upload
 * - "default": เก็บไฟล์ดิบเหมือนเดิม (รูปเครื่องจักร/อะไหล่/แนบไฟล์ ฯลฯ — ต้องการความละเอียดเดิม)
 * - "productLineIcon": ใช้เฉพาะไอคอนหมวด (product line) ที่หน้า /settings/home-screen —
 *   ครอปเป็นสี่เหลี่ยมจัตุรัส กึ่งกลาง แล้วบีบอัดเป็น WebP ให้ตรงกับการแสดงผลจริง
 *   (sidebar rail / launcher ใช้ CSS `object-cover` ในกรอบสี่เหลี่ยม)
 */
export type UploadProfile = "default" | "productLineIcon"

export const UPLOAD_PROFILES = ["default", "productLineIcon"] as const

export function isUploadProfile(value: unknown): value is UploadProfile {
  return value === "default" || value === "productLineIcon"
}

/** ขนาดเป้าหมาย (px) สำหรับไอคอนหมวด — สี่เหลี่ยมจัตุรัส ใช้ทั้ง sidebar และ launcher */
export const ICON_SQUARE_SIZE = 512

const ICON_WEBP_QUALITY = 80

export interface ProcessedUpload {
  buffer: Buffer
  ext: string
  contentType: string
}

/**
 * ประมวลผล buffer รูปตาม profile ที่ระบุ
 * @throws Error ถ้าไฟล์ไม่ใช่รูปภาพที่ถอดรหัสได้ (เช่น ไฟล์เสียหาย) — เฉพาะ profile ที่ต้อง sharp ประมวลผล
 */
export async function processUploadBuffer(
  buffer: Buffer,
  originalExt: string,
  profile: UploadProfile
): Promise<ProcessedUpload> {
  if (profile === "productLineIcon") {
    const webp = await sharp(buffer)
      .rotate() // ปรับตาม EXIF orientation ก่อนครอป
      .resize(ICON_SQUARE_SIZE, ICON_SQUARE_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality: ICON_WEBP_QUALITY })
      .toBuffer()

    return { buffer: webp, ext: "webp", contentType: "image/webp" }
  }

  return { buffer, ext: originalExt, contentType: "" }
}
