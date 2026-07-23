import { NextRequest, NextResponse } from "next/server"
import { unlink } from "fs/promises"
import { join } from "path"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { deleteMachineImage, updateMachineImagePrimary } from "@/modules/machines"

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; imageId: string }> }
) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { isPrimary } = await req.json()
  const result = await updateMachineImagePrimary(prisma, {
    machineId: params.id,
    imageId: params.imageId,
    companyId: session.user.companyId as string,
    isPrimary: !!isPrimary,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; imageId: string }> }
) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await deleteMachineImage(prisma, {
    machineId: params.id,
    imageId: params.imageId,
    companyId: session.user.companyId as string,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  try {
    const filepath = join(process.cwd(), "public", result.fileUrl)
    await unlink(filepath)
  } catch (err) {
    console.error("Failed to delete file:", err)
  }

  return NextResponse.json({ success: true })
}
