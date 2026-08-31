export type AssetDto = {
  id: string
  companyId: string
  branchId: string
  branchName: string
  code: string
  name: string
  type: "VEHICLE" | "MACHINE"
  status: "REGISTERED" | "ACTIVE" | "IDLE" | "RETIRED" | "DISPOSED"
  ownership: "COMPANY" | "LEASED" | "EXTERNAL"
  serialNumber: string | null
  locationDetail: string | null
  supplierId: string | null
  supplierName: string | null
  acquiredAt: string | null
  isActive: boolean
  createdById: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
}
