import sharp from "sharp"

/**
 * โปรไฟล์การประมวลผลรูปตอนอัปโหลด — ใช้ร่วมกับ POST /api/upload
 * - "default": เก็บไฟล์ดิบเหมือนเดิม (รูปเครื่องจักร/อะไหล่/แนบไฟล์ ฯลฯ — ต้องการความละเอียดเดิม)
 * - "homeScreenIcon": ไอคอนหน้าจอหลัก (กลุ่มงาน / โมดูลย่อย) ที่ /settings/home-screen —
 *   ครอปเป็นสี่เหลี่ยมจัตุรัส กึ่งกลาง แล้วบีบอัดเป็น WebP ให้ตรงกับการแสดงผลจริง
 * - "productLineIcon": alias เก่าของ homeScreenIcon (ยังรับได้)
 */
export type UploadProfile = "default" | "homeScreenIcon" | "productLineIcon"

export const UPLOAD_PROFILES = ["default", "homeScreenIcon", "productLineIcon"] as const

export type HomeScreenAssetKind = "product-line" | "module"

export const HOME_SCREEN_ASSET_KINDS = ["product-line", "module"] as const

export function isUploadProfile(value: unknown): value is UploadProfile {
  return value === "default" || value === "homeScreenIcon" || value === "productLineIcon"
}

export function isHomeScreenIconProfile(profile: UploadProfile): boolean {
  return profile === "homeScreenIcon" || profile === "productLineIcon"
}

export function isHomeScreenAssetKind(value: unknown): value is HomeScreenAssetKind {
  return value === "product-line" || value === "module"
}

/** ขนาดเป้าหมาย (px) สำหรับไอคอนหมวด — สี่เหลี่ยมจัตุรัส ใช้ทั้ง sidebar และ launcher */
export const ICON_SQUARE_SIZE = 512

const ICON_WEBP_QUALITY = 80

const ASSET_ID_RE = /^[\w-]+$/

export function isValidHomeScreenAssetId(value: unknown): value is string {
  return typeof value === "string" && ASSET_ID_RE.test(value) && value.length <= 80
}

/** โฟลเดอร์ย่อยใต้ public/home-screen ตามชนิด asset */
export function homeScreenSubdir(kind: HomeScreenAssetKind): "product-lines" | "modules" {
  return kind === "product-line" ? "product-lines" : "modules"
}

/**
 * URL พร้อม cache-bust สำหรับไฟล์ไอคอนหน้าจอหลัก
 * รูปแบบ: /home-screen/{product-lines|modules}/{id}.webp?v={timestamp}
 */
export function homeScreenFileUrl(kind: HomeScreenAssetKind, assetId: string, cacheBust: number): string {
  return `/home-screen/${homeScreenSubdir(kind)}/${assetId}.webp?v=${cacheBust}`
}

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
  if (isHomeScreenIconProfile(profile)) {
    const webp = await sharp(buffer)
      .rotate() // ปรับตาม EXIF orientation ก่อนครอป
      .resize(ICON_SQUARE_SIZE, ICON_SQUARE_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality: ICON_WEBP_QUALITY })
      .toBuffer()

    return { buffer: webp, ext: "webp", contentType: "image/webp" }
  }

  return { buffer, ext: originalExt, contentType: "" }
}
