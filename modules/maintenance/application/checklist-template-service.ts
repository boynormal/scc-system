import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))

const optionalNumber = z
  .union([z.number(), z.string().trim()])
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (value === undefined || value === null || value === "") return null
    const number = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(number)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ต้องเป็นตัวเลข" })
      return z.NEVER
    }
    return number
  })

export const checklistItemInputSchema = z
  .object({
    section: optionalText(100),
    itemName: z.string().trim().min(1).max(255),
    itemType: z.enum(["checkbox", "numeric", "text", "select", "photo"]).default("checkbox"),
    standardValue: optionalText(100),
    minValue: optionalNumber,
    maxValue: optionalNumber,
    unit: optionalText(30),
    isRequired: z.boolean().default(true),
  })
  .refine((item) => item.minValue === null || item.maxValue === null || item.minValue <= item.maxValue, {
    message: "ค่าต่ำสุดต้องไม่มากกว่าค่าสูงสุด",
    path: ["maxValue"],
  })

export const createChecklistTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  categoryId: z.string().uuid().optional().nullable(),
  typeId: z.string().uuid().optional().nullable(),
  items: z.array(checklistItemInputSchema).min(1).max(200),
})

export const updateChecklistTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  typeId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  items: z.array(checklistItemInputSchema).min(1).max(200).optional(),
})

export type CreateChecklistTemplateInput = z.infer<typeof createChecklistTemplateSchema>
export type UpdateChecklistTemplateInput = z.infer<typeof updateChecklistTemplateSchema>
type ItemInput = z.infer<typeof checklistItemInputSchema>

const templateInclude = {
  category: { select: { id: true, name: true } },
  type: { select: { id: true, name: true, code: true } },
  items: { orderBy: { sequence: "asc" } },
  _count: { select: { planChecklistTemplates: true } },
} satisfies Prisma.ChecklistTemplateInclude

function itemRows(items: ItemInput[]) {
  return items.map((item, index) => ({
    sequence: index + 1,
    section: item.section,
    itemName: item.itemName,
    itemType: item.itemType,
    standardValue: item.standardValue,
    minValue: item.minValue,
    maxValue: item.maxValue,
    unit: item.unit,
    isRequired: item.isRequired,
  }))
}

async function validateRefs(
  db: PrismaClient,
  companyId: string,
  refs: { categoryId?: string | null; typeId?: string | null }
) {
  if (refs.categoryId) {
    const category = await db.machineCategory.findFirst({
      where: { id: refs.categoryId, companyId },
      select: { id: true },
    })
    if (!category) return "Invalid category"
  }
  if (refs.typeId) {
    const type = await db.maintenanceType.findFirst({
      where: { id: refs.typeId, companyId },
      select: { id: true },
    })
    if (!type) return "Invalid maintenance type"
  }
  return null
}

export async function listChecklistTemplates(
  db: PrismaClient,
  params: { companyId: string; includeInactive?: boolean }
) {
  return db.checklistTemplate.findMany({
    where: { companyId: params.companyId, ...(params.includeInactive ? {} : { isActive: true }) },
    include: templateInclude,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  })
}

export async function createChecklistTemplate(
  db: PrismaClient,
  params: { companyId: string; userId: string; input: CreateChecklistTemplateInput }
) {
  const refError = await validateRefs(db, params.companyId, params.input)
  if (refError) return { error: refError, status: 400 as const }
  const template = await db.checklistTemplate.create({
    data: {
      companyId: params.companyId,
      name: params.input.name,
      categoryId: params.input.categoryId ?? null,
      typeId: params.input.typeId ?? null,
      createdBy: params.userId,
      items: { create: itemRows(params.input.items) },
    },
    include: templateInclude,
  })
  return { data: template }
}

export async function updateChecklistTemplate(
  db: PrismaClient,
  params: { id: string; companyId: string; userId: string; input: UpdateChecklistTemplateInput }
) {
  const existing = await db.checklistTemplate.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: { items: { orderBy: { sequence: "asc" } } },
  })
  if (!existing) return { error: "Not found" as const, status: 404 as const }
  const refError = await validateRefs(db, params.companyId, params.input)
  if (refError) return { error: refError, status: 400 as const }

  const { items, ...fields } = params.input
  if (items) {
    const used = await db.checklistResult.count({ where: { item: { templateId: params.id } } })
    if (used > 0) {
      return {
        error: "แม่แบบนี้มีผลตรวจแล้ว แก้รายการตรวจไม่ได้ ให้สร้างแม่แบบใหม่แล้วปิดใช้แม่แบบเดิม" as const,
        status: 409 as const,
      }
    }
  }

  const updated = await db.$transaction(async (tx) => {
    if (items) {
      await tx.checklistItem.deleteMany({ where: { templateId: params.id } })
      await tx.checklistItem.createMany({
        data: itemRows(items).map((row) => ({ ...row, templateId: params.id })),
      })
    }
    const template = await tx.checklistTemplate.update({
      where: { id: params.id },
      data: {
        ...fields,
        ...(items ? { version: { increment: 1 } } : {}),
      },
      include: templateInclude,
    })
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        tableName: "checklist_templates",
        recordId: params.id,
        action: "update",
        oldValues: JSON.parse(JSON.stringify(existing)),
        newValues: JSON.parse(JSON.stringify(template)),
      },
    })
    return template
  })
  return { data: updated }
}
