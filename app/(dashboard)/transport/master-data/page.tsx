"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { LookupTypesTab } from "@/components/transport/master-data/LookupTypesTab"
import { CustomersTab } from "@/components/transport/master-data/CustomersTab"
import { VehiclesTab } from "@/components/transport/master-data/VehiclesTab"
import { DriversTab } from "@/components/transport/master-data/DriversTab"

const TABS = [
  { id: "job-types", label: "ประเภทงาน" },
  { id: "cargo-types", label: "ประเภทสินค้า" },
  { id: "vehicle-types", label: "ประเภทรถ" },
  { id: "customers", label: "ลูกค้า/ปลายทาง" },
  { id: "vehicles", label: "จัดการรถ" },
  { id: "drivers", label: "คนขับ" },
] as const

type TabId = (typeof TABS)[number]["id"]

function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ")
}

function MasterDataContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = searchParams.get("tab") as TabId | null
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "job-types"
  )

  useEffect(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam as TabId)
    }
  }, [tabParam])

  const switchTab = (id: TabId) => {
    setActiveTab(id)
    router.replace(`/transport/master-data?tab=${id}`, { scroll: false })
  }

  return (
    <div className="-m-6 space-y-6 p-4 md:p-6 w-auto min-w-0">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">ข้อมูลพื้นฐาน (Master Data)</h1>
        <p className="text-sm text-slate-500 mt-1">
          จัดการประเภทงาน ประเภทสินค้า ลูกค้า/ปลายทาง รถ และคนขับ
        </p>
      </div>

      <div className="flex flex-wrap border-b border-slate-200 gap-x-1 -mb-px overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchTab(tab.id)}
            className={classNames(
              "whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-cyan-600 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === "job-types" && (
          <LookupTypesTab
            apiPath="/api/transport/master-data/job-types"
            addLabel="เพิ่มประเภทงาน"
            nameLabel="ประเภทงาน"
          />
        )}
        {activeTab === "cargo-types" && (
          <LookupTypesTab
            apiPath="/api/transport/master-data/cargo-types"
            addLabel="เพิ่มประเภทสินค้า"
            nameLabel="ประเภทสินค้า"
          />
        )}
        {activeTab === "vehicle-types" && (
          <LookupTypesTab
            apiPath="/api/transport/master-data/vehicle-types"
            addLabel="เพิ่มประเภทรถ"
            nameLabel="ประเภทรถ"
          />
        )}
        {activeTab === "customers" && <CustomersTab />}
        {activeTab === "vehicles" && <VehiclesTab />}
        {activeTab === "drivers" && <DriversTab />}
      </div>
    </div>
  )
}

export default function TransportMasterDataPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">กำลังโหลด...</div>}>
      <MasterDataContent />
    </Suspense>
  )
}
