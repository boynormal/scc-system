"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { GlassButton } from "@/components/glass"
import { LookupTypesTab } from "@/components/transport/master-data/LookupTypesTab"
import { VehicleTypesTab } from "@/components/transport/master-data/VehicleTypesTab"
import { CustomersTab } from "@/components/transport/master-data/CustomersTab"
import { VehiclesTab } from "@/components/transport/master-data/VehiclesTab"
import { DriversTab } from "@/components/transport/master-data/DriversTab"
import {
  TransportSearchField,
  TransportSegmentedTabs,
} from "@/components/transport/toolbar"

const TABS = [
  {
    id: "job-types",
    label: "ประเภทงาน",
    addLabel: "เพิ่มประเภทงาน",
    searchPlaceholder: "ค้นหาประเภทงาน...",
  },
  {
    id: "cargo-types",
    label: "ประเภทสินค้า",
    addLabel: "เพิ่มประเภทสินค้า",
    searchPlaceholder: "ค้นหาประเภทสินค้า...",
  },
  {
    id: "vehicle-types",
    label: "ประเภทรถ",
    addLabel: "เพิ่มประเภทรถ",
    searchPlaceholder: "ค้นหาประเภทรถ...",
  },
  {
    id: "customers",
    label: "ลูกค้า/ปลายทาง",
    addLabel: "เพิ่มลูกค้า/ปลายทาง",
    searchPlaceholder: "ค้นหาลูกค้า / ที่อยู่ / ผู้ติดต่อ...",
  },
  {
    id: "vehicles",
    label: "จัดการรถ",
    addLabel: "เพิ่มรถ",
    searchPlaceholder: "ค้นหาทะเบียน / ชื่อรถ / IMEI...",
  },
  {
    id: "drivers",
    label: "คนขับ",
    addLabel: "เพิ่มคนขับ",
    searchPlaceholder: "ค้นหาชื่อ / โทรศัพท์ / รหัส...",
  },
] as const

type TabId = (typeof TABS)[number]["id"]

function MasterDataContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = searchParams.get("tab") as TabId | null
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((tab) => tab.id === tabParam) ? (tabParam as TabId) : "job-types"
  )
  const [search, setSearch] = useState("")
  const [addRequest, setAddRequest] = useState(0)

  useEffect(() => {
    if (tabParam && TABS.some((tab) => tab.id === tabParam)) {
      setActiveTab(tabParam as TabId)
    }
  }, [tabParam])

  const switchTab = (id: TabId) => {
    setActiveTab(id)
    setSearch("")
    router.replace(`/transport/master-data?tab=${id}`, { scroll: false })
  }

  const activeMeta = TABS.find((tab) => tab.id === activeTab)!

  return (
    <div className="min-w-0 space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <TransportSegmentedTabs
            activeKey={activeTab}
            onChange={(key) => switchTab(key as TabId)}
            items={TABS.map((tab) => ({ key: tab.id, label: tab.label }))}
          />

          <TransportSearchField
            value={search}
            onChange={setSearch}
            placeholder={activeMeta.searchPlaceholder}
          />
        </div>

        <GlassButton
          onClick={() => setAddRequest((n) => n + 1)}
          icon={<Plus className="w-4 h-4" />}
        >
          {activeMeta.addLabel}
        </GlassButton>
      </div>

      <div className="min-w-0">
        {activeTab === "job-types" && (
          <LookupTypesTab
            apiPath="/api/transport/master-data/job-types"
            nameLabel="ประเภทงาน"
            search={search}
            addRequest={addRequest}
          />
        )}
        {activeTab === "cargo-types" && (
          <LookupTypesTab
            apiPath="/api/transport/master-data/cargo-types"
            nameLabel="ประเภทสินค้า"
            search={search}
            addRequest={addRequest}
          />
        )}
        {activeTab === "vehicle-types" && (
          <VehicleTypesTab search={search} addRequest={addRequest} />
        )}
        {activeTab === "customers" && (
          <CustomersTab search={search} addRequest={addRequest} />
        )}
        {activeTab === "vehicles" && (
          <VehiclesTab search={search} addRequest={addRequest} />
        )}
        {activeTab === "drivers" && (
          <DriversTab search={search} addRequest={addRequest} />
        )}
      </div>
    </div>
  )
}

export default function TransportMasterDataPage() {
  return (
    <div className="min-w-0 overflow-x-hidden">
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">กำลังโหลด...</div>}>
        <MasterDataContent />
      </Suspense>
    </div>
  )
}
