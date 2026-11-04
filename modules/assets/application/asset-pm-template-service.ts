import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"

const NOT_FOUND = "ไม่พบรายการ"
const DUPLICATE = "ชื่อเทมเพลตนี้มีอยู่แล้ว"
const INVALID = "ข้อมูลไม่ถูกต้อง"
const MAX_AUDIO_BYTES = 256 * 1024
const AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"])

const detailField = z
  .string()
  .trim()
  .max(255)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

const blankToNull = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

const itemSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    detail: detailField,
    audioBase64: blankToNull,
    audioContentType: blankToNull,
    sourceItemId: z
      .string()
      .uuid()
      .optional()
      .nullable()
      .transform((value) => value ?? null),
  })
  .superRefine((item, ctx) => {
    if (item.audioBase64 && item.sourceItemId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: INVALID })
    }
    if (item.audioBase64 && !item.audioContentType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: INVALID, path: ["audioContentType"] })
    }
  })

const itemListSchema = z.array(itemSchema).min(1).max(50)

export const createAssetPmTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  items: itemListSchema,
})

export const updateAssetPmTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  items: itemListSchema.optional(),
})

type ItemInput = z.infer<typeof itemSchema>
function toBytes(bytes: Uint8Array | null): Uint8Array<ArrayBuffer> | null {
  if (!bytes) return null
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

type StoredAudio = { audioBytes: Uint8Array; audioContentType: string }

function canAssets(roles: UserRole[], action: "read" | "update"): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", action))
  )
}

function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new ValidationError(INVALID)
  return parsed.data
}

export function audioFromBase64(base64: string, contentType: string): StoredAudio {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? ""
  if (!AUDIO_TYPES.has(type)) throw new ValidationError(INVALID)
  const bytes = Buffer.from(base64, "base64")
  if (bytes.length === 0 || bytes.length > MAX_AUDIO_BYTES) throw new ValidationError(INVALID)
  return { audioBytes: new Uint8Array(bytes), audioContentType: type }
}

function canAssetsReadOrThrow(roles: UserRole[]) {
  if (!canAssets(roles, "read")) throw new ForbiddenError()
}

const itemSelect = {
  id: true,
  sequence: true,
  name: true,
  detail: true,
  audioContentType: true,
} satisfies Prisma.AssetPmTemplateItemSelect

const templateInclude = {
  items: { orderBy: { sequence: "asc" as const }, select: itemSelect },
}

function serialize(row: {
  id: string
  name: string
  isActive: boolean
  items: { id: string; sequence: number; name: string; detail: string | null; audioContentType: string | null }[]
}) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    items: row.items.map((item) => ({
      id: item.id,
      sequence: item.sequence,
      name: item.name,
      detail: item.detail,
      hasAudio: item.audioContentType != null,
    })),
  }
}

function rowsFromAudio(
  items: ItemInput[],
  audioBySource: Map<string, StoredAudio>
) {
  return items.map((item, index) => {
    const kept = item.sourceItemId ? audioBySource.get(item.sourceItemId) : undefined
    const fresh = item.audioBase64 && item.audioContentType ? audioFromBase64(item.audioBase64, item.audioContentType) : null
    const audio = fresh ?? kept ?? null
    return {
      sequence: index + 1,
      name: item.name,
      detail: item.detail,
      audioBytes: toBytes(audio?.audioBytes ?? null),
      audioContentType: audio?.audioContentType ?? null,
    }
  })
}

export async function listAssetPmTemplates(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; activeOnly?: boolean }
) {
  canAssetsReadOrThrow(params.roles)
  const rows = await db.assetPmTemplate.findMany({
    where: { companyId: params.companyId, ...(params.activeOnly ? { isActive: true } : {}) },
    include: templateInclude,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  })
  return { data: rows.map(serialize) }
}

export async function createAssetPmTemplate(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: unknown }
) {
  if (!canAssets(params.roles, "update")) throw new ForbiddenError()
  const input = parseInput(createAssetPmTemplateSchema, params.input)
  if (input.items.some((item) => item.sourceItemId)) throw new ValidationError(INVALID)
  const clash = await db.assetPmTemplate.findFirst({
    where: { companyId: params.companyId, name: input.name },
    select: { id: true },
  })
  if (clash) throw new ValidationError(DUPLICATE)
  const row = await db.assetPmTemplate.create({
    data: {
      companyId: params.companyId,
      name: input.name,
      items: { create: rowsFromAudio(input.items, new Map()) },
    },
    include: templateInclude,
  })
  return { data: serialize(row) }
}

async function requireTemplate(db: PrismaClient, companyId: string, id: string) {
  const current = await db.assetPmTemplate.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!current) throw new NotFoundError(NOT_FOUND)
  return current
}

async function loadKeptAudio(db: PrismaClient, templateId: string, items: ItemInput[]) {
  const sourceIds = [...new Set(items.flatMap((item) => (item.sourceItemId ? [item.sourceItemId] : [])))]
  if (sourceIds.length === 0) return new Map<string, StoredAudio>()
  const found = await db.assetPmTemplateItem.findMany({
    where: { templateId, id: { in: sourceIds } },
    select: { id: true, audioBytes: true, audioContentType: true },
  })
  if (found.length !== sourceIds.length) throw new ValidationError(INVALID)
  return new Map(
    found.flatMap((row) =>
      row.audioBytes && row.audioContentType
        ? [[row.id, { audioBytes: new Uint8Array(row.audioBytes), audioContentType: row.audioContentType }]]
        : []
    )
  )
}

export async function updateAssetPmTemplate(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: unknown }
) {
  if (!canAssets(params.roles, "update")) throw new ForbiddenError()
  const input = parseInput(updateAssetPmTemplateSchema, params.input)
  await requireTemplate(db, params.companyId, params.id)
  if (input.name) {
    const clash = await db.assetPmTemplate.findFirst({
      where: { companyId: params.companyId, name: input.name, NOT: { id: params.id } },
      select: { id: true },
    })
    if (clash) throw new ValidationError(DUPLICATE)
  }
  const kept = input.items ? await loadKeptAudio(db, params.id, input.items) : new Map<string, StoredAudio>()
  const nextItems = input.items ? rowsFromAudio(input.items, kept) : null
  const row = await db.$transaction(async (tx) => {
    if (nextItems) {
      await tx.assetPmTemplateItem.deleteMany({ where: { templateId: params.id } })
    }
    return tx.assetPmTemplate.update({
      where: { id: params.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(nextItems ? { items: { create: nextItems } } : {}),
      },
      include: templateInclude,
    })
  })
  return { data: serialize(row) }
}

export async function deleteAssetPmTemplate(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canAssets(params.roles, "update")) throw new ForbiddenError()
  await requireTemplate(db, params.companyId, params.id)
  await db.assetPmTemplate.delete({ where: { id: params.id } })
  return { success: true as const }
}

export async function getAssetPmTemplateItemAudio(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; templateId: string; itemId: string }
) {
  canAssetsReadOrThrow(params.roles)
  const item = await db.assetPmTemplateItem.findFirst({
    where: { id: params.itemId, templateId: params.templateId, template: { companyId: params.companyId } },
    select: { audioBytes: true, audioContentType: true },
  })
  if (!item?.audioBytes || !item.audioContentType) throw new NotFoundError(NOT_FOUND)
  return { bytes: new Uint8Array(item.audioBytes), contentType: item.audioContentType }
}
