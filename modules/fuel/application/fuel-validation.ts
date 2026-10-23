import type { z } from "zod"
import { ValidationError } from "@/lib/errors"

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
}

/** Parse at the service boundary; failures surface as 400 instead of 500. */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error))
  return parsed.data
}
