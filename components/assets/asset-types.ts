export type AssetDto = {
  id: string
  companyId: string
  branchId: string
  branchName: string
  code: string
  name: string
  typeId: string
  typeName: string
  status: "REGISTERED" | "ACTIVE" | "IDLE" | "RETIRED" | "DISPOSED"
  ownership: "COMPANY" | "LEASED" | "EXTERNAL"
  fuelMeterType: "ODOMETER" | "HOUR_METER" | "NONE"
  serialNumber: string | null
  details: string | null
  acquiredAt: string | null
  isActive: boolean
  maintenancePmEnabled: boolean
  createdById: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
}
