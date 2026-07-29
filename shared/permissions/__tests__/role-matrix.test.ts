import { describe, expect, it } from "vitest"
import {
  matrixFormToStored,
  storedToMatrixForm,
  formKey,
  emptyMatrixFormState,
} from "@/shared/permissions/role-matrix"

describe("role-matrix converters", () => {
  it("round-trips matrix form for known resources", () => {
    const form = emptyMatrixFormState()
    form[formKey("machines", "read")] = true
    form[formKey("machines", "update")] = true
    form[formKey("transport_jobs", "read")] = true
    form[formKey("work_orders", "approve")] = true

    const stored = matrixFormToStored(form)
    expect(stored.machines).toEqual(["read", "update"])
    expect(stored.transport_jobs).toEqual(["read"])
    expect(stored.work_orders).toEqual(["approve"])
    expect(stored.moduleAccess).toBeUndefined()

    const back = storedToMatrixForm(stored as Record<string, unknown>)
    expect(back[formKey("machines", "read")]).toBe(true)
    expect(back[formKey("machines", "update")]).toBe(true)
    expect(back[formKey("machines", "delete")]).toBe(false)
    expect(back[formKey("transport_jobs", "read")]).toBe(true)
    expect(back[formKey("work_orders", "approve")]).toBe(true)
  })

  it("preserves unknown legacy keys and strips moduleAccess on update", () => {
    const previous = {
      machines: ["read"],
      legacy_custom: ["read", "update"],
      moduleAccess: ["machines"] as string[],
    }
    const form = emptyMatrixFormState()
    form[formKey("machines", "read")] = true
    form[formKey("hr_personnel", "read")] = true

    const stored = matrixFormToStored(form, previous)
    expect(stored.machines).toEqual(["read"])
    expect(stored.hr_personnel).toEqual(["read"])
    expect((stored as Record<string, unknown>).legacy_custom).toEqual(["read", "update"])
    expect(stored.moduleAccess).toBeUndefined()
  })

  it("merges DEFAULT_ROLE_PERMISSIONS when stored is null", () => {
    const form = storedToMatrixForm(null, "Viewer")
    expect(form[formKey("machines", "read")]).toBe(true)
    expect(form[formKey("machines", "delete")]).toBe(false)
    expect(form[formKey("transport_jobs", "read")]).toBe(true)
  })

  it("lets stored permissions override defaults for known resources", () => {
    const form = storedToMatrixForm({ machines: ["read", "update"] }, "Viewer")
    expect(form[formKey("machines", "read")]).toBe(true)
    expect(form[formKey("machines", "update")]).toBe(true)
    expect(form[formKey("machines", "delete")]).toBe(false)
    // resources missing from stored still fall back to Viewer defaults
    expect(form[formKey("transport_jobs", "read")]).toBe(true)
  })

  it("clears a resource when all actions unchecked", () => {
    const previous = { machines: ["read", "update"], transport_jobs: ["read"] }
    const form = emptyMatrixFormState()
    form[formKey("transport_jobs", "read")] = true
    const stored = matrixFormToStored(form, previous)
    expect(stored.machines).toBeUndefined()
    expect(stored.transport_jobs).toEqual(["read"])
  })
})
