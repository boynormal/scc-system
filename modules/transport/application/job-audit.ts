import type { Prisma, PrismaClient } from "@prisma/client"

type JobAuditAction = "create" | "update" | "delete"

export async function writeJobAudit(
  db: PrismaClient,
  params: {
    userId?: string | null
    jobId: string
    action: JobAuditAction
    event: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
  }
) {
  await db.auditLog.create({
    data: {
      userId: params.userId ?? null,
      tableName: "transport_jobs",
      recordId: params.jobId,
      action: params.action,
      oldValues: (params.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      newValues: {
        event: params.event,
        ...(params.newValues ?? {}),
      } as Prisma.InputJsonValue,
    },
  })
}

export async function listJobHistory(db: PrismaClient, jobId: string) {
  const rows = await db.auditLog.findMany({
    where: { tableName: "transport_jobs", recordId: jobId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { firstName: true, lastName: true } } },
  })
  return rows.map((row) => {
    const values = (row.newValues ?? {}) as { event?: string; summary?: string }
    return {
      id: row.id.toString(),
      at: row.createdAt.toISOString(),
      actor: row.user ? `${row.user.firstName} ${row.user.lastName}`.trim() : "ระบบ",
      event: values.event ?? row.action,
      summary: values.summary ?? "",
    }
  })
}
