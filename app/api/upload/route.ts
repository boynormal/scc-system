import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { isUploadProfile, processUploadBuffer } from "@/lib/upload/image-profiles"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const rawProfile = formData.get("profile")
    const profile = isUploadProfile(rawProfile) ? rawProfile : "default"

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

    // Create uploads directory if not exists
    const uploadDir = join(process.cwd(), "public", "uploads")
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate unique filename
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
