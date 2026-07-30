import { z } from "zod"
import type { PrismaClient } from "@prisma/client"

export const VEHICLE_WHEEL_COUNTS = [4, 6, 10, 12, 18, 22] as const
export type VehicleWheelCount = (typeof VEHICLE_WHEEL_COUNTS)[number]

export type WheelLayout = number[][]

export const DEFAULT_WHEEL_LAYOUTS: Record<VehicleWheelCount, WheelLayout> = {
  4: [
    [1, 2],
    [3, 4],
  ],
  6: [
    [1, 2],
    [3, 4, 5, 6],
  ],
  10: [
    [1, 2],
    [3, 4, 5, 6],
    [7, 8, 9, 10],
  ],
  12: [
    [1, 2],
    [3, 4, 5, 6],
    [7, 8, 9, 10],
    [11, 12],
  ],
  18: [
    [1, 2],
    [3, 4, 5, 6],
    [7, 8, 9, 10],
    [11, 12, 13, 14],
    [15, 16, 17, 18],
  ],
  22: [
    [1, 2],
    [3, 4, 5, 6],
    [7, 8, 9, 10],
    [11, 12, 13, 14],
    [15, 16, 17, 18],
    [19, 20, 21, 22],
  ],
}

export const vehicleWheelCountSchema = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(10),
  z.literal(12),
  z.literal(18),
  z.literal(22),
])

const axleSchema = z.array(z.number().int().positive()).min(1)

export function validateWheelLayoutAgainstCount(
  layout: unknown,
  wheelCount: number
): { ok: true; layout: WheelLayout } | { ok: false; message: string } {
  const parsed = z.array(axleSchema).min(1).safeParse(layout)
  if (!parsed.success) {
    return { ok: false, message: "wheelLayout must be a non-empty array of axles with positions" }
  }

  const flat = parsed.data.flat()
  if (flat.length !== wheelCount) {
    return {
      ok: false,
      message: `wheelLayout must contain exactly ${wheelCount} positions (got ${flat.length})`,
    }
  }

  const unique = new Set(flat)
  if (unique.size !== flat.length) {
    return { ok: false, message: "wheelLayout positions must be unique" }
  }

  for (let i = 1; i <= wheelCount; i++) {
    if (!unique.has(i)) {
      return { ok: false, message: `wheelLayout is missing position ${i}` }
    }
  }

  return { ok: true, layout: parsed.data }
}

export function wheelLayoutSchemaForCount(wheelCount: number) {
  return z.unknown().superRefine((val, ctx) => {
    const result = validateWheelLayoutAgainstCount(val, wheelCount)
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message })
    }
  })
}

export function getDefaultWheelLayout(count: VehicleWheelCount): WheelLayout {
  return DEFAULT_WHEEL_LAYOUTS[count].map((axle) => [...axle])
}

export function normalizeWheelLayout(value: unknown): WheelLayout | null {
  if (!Array.isArray(value)) return null
  const layout: WheelLayout = []
  for (const axle of value) {
    if (!Array.isArray(axle) || axle.length === 0) return null
    const positions: number[] = []
    for (const pos of axle) {
      const n = typeof pos === "number" ? pos : Number(pos)
      if (!Number.isInteger(n) || n < 1) return null
      positions.push(n)
    }
    layout.push(positions)
  }
  return layout.length > 0 ? layout : null
}

export function isValidWheelPosition(layout: WheelLayout, position: number): boolean {
  return layout.some((axle) => axle.includes(position))
}

export function flattenWheelLayout(layout: WheelLayout): number[] {
  return layout.flat()
}

export type VehicleWheelConfig = {
  wheelCount: VehicleWheelCount
  wheelLayout: WheelLayout
}

export async function resolveVehicleTypeWheelConfig(
  db: PrismaClient,
  params: { companyId: string; vehicleTypeName: string }
): Promise<VehicleWheelConfig | null> {
  const row = await db.transportVehicleType.findFirst({
    where: {
      companyId: params.companyId,
      name: params.vehicleTypeName,
      isActive: true,
    },
    select: { wheelCount: true, wheelLayout: true },
  })
  if (!row?.wheelCount) return null
  const countParsed = vehicleWheelCountSchema.safeParse(row.wheelCount)
  if (!countParsed.success) return null

  const fromDb = normalizeWheelLayout(row.wheelLayout)
  if (fromDb) {
    const validated = validateWheelLayoutAgainstCount(fromDb, countParsed.data)
    if (validated.ok) {
      return { wheelCount: countParsed.data, wheelLayout: validated.layout }
    }
  }

  return {
    wheelCount: countParsed.data,
    wheelLayout: getDefaultWheelLayout(countParsed.data),
  }
}
