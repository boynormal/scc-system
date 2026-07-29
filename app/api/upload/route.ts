import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { auth } from "@/lib/auth"
import { getBranchIds, hasPermission, type UserRole } from "@/lib/permissions"
import {
  homeScreenFileUrl,
  homeScreenSubdir,
  isHomeScreenAssetKind,
  isHomeScreenIconProfile,
  isUploadProfile,
  isValidHomeScreenAssetId,
  processUploadBuffer,
} from "@/lib/upload/image-profiles"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const rawProfile = formData.get("profile")
    const profile = isUploadProfile(rawProfile) ? rawProfile : "default"

    if (isHomeScreenIconProfile(profile)) {
      const roles = (session.user.roles ?? []) as UserRole[]
      const canUpdate = getBranchIds(roles).some((branchId) =>
        hasPermission(roles, branchId, "settings", "update")
      )
      if (!canUpdate) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const assetKindRaw = formData.get("assetKind")
      const assetIdRaw = formData.get("assetId")
      if (!isHomeScreenAssetKind(assetKindRaw) || !isValidHomeScreenAssetId(assetIdRaw)) {
        return NextResponse.json(
          {
            error: {
              message: "ต้องระบุ assetKind (product-line|module) และ assetId ที่ถูกต้อง",
            },
          },
          { status: 400 }
        )
      }
    }

    const bytes = await file.arrayBuffer()
    const rawBuffer = Buffer.from(bytes)
    const originalExt = file.name.split(".").pop() ?? "bin"

    let processed
    try {
      processed = await processUploadBuffer(rawBuffer, originalExt, profile)
    } catch (err) {
      console.error("Image processing error:", err)
      return NextResponse.json(
        { error: { message: "ไม่สามารถประมวลผลรูปภาพนี้ได้ กรุณาลองใช้ไฟล์รูปอื่น" } },
        { status: 400 }
      )
    }

    if (isHomeScreenIconProfile(profile)) {
      const assetKind = formData.get("assetKind")
      const assetId = formData.get("assetId")
      // validated above
      if (!isHomeScreenAssetKind(assetKind) || !isValidHomeScreenAssetId(assetId)) {
        return NextResponse.json({ error: "Invalid asset" }, { status: 400 })
      }

      const subdir = homeScreenSubdir(assetKind)
      const uploadDir = join(process.cwd(), "public", "home-screen", subdir)
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }

      const filename = `${assetId}.webp`
      const filepath = join(uploadDir, filename)
      await writeFile(filepath, processed.buffer)

      const cacheBust = Date.now()
      const fileUrl = homeScreenFileUrl(assetKind, assetId, cacheBust)
      return NextResponse.json({
        success: true,
        data: {
          fileUrl,
          fileName: file.name,
          fileSize: processed.buffer.length,
        },
      })
    }

    // default: runtime uploads (machines, spare parts, etc.)
    const uploadDir = join(process.cwd(), "public", "uploads")
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const timestamp = Date.now()
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${processed.ext}`
    const filepath = join(uploadDir, filename)

    await writeFile(filepath, processed.buffer)

    const fileUrl = `/uploads/${filename}`
    return NextResponse.json({
      success: true,
      data: {
        fileUrl,
        fileName: file.name,
        fileSize: processed.buffer.length,
      },
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
