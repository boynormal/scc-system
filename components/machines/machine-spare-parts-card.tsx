"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { ChevronDown, ChevronUp, Loader2, Package, Plus, Search, Trash2, X } from "lucide-react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ImageUpload } from "@/components/ui/image-upload"
import { ClickableImage } from "@/components/ui/clickable-image"

type SupplierMini = { id: string; name: string } | null

type PartMini = {
  id: string
  code: string
  name: string
  description: string | null
  imageUrl: string | null
  unit: string
  unitCost: string
  supplier: SupplierMini
}

export type MachineSparePartLine = {
  id: string
  machineId: string
  partId: string
  sortOrder: number
  qtyRecommended: number
  note: string | null
  installPhotoUrl: string | null
  locationOnMachine: string | null
  part: PartMini
}

type SparePartSearchRow = {
  id: string
  code: string
  name: string
  imageUrl: string | null
  supplier: SupplierMini
}

interface MachineSparePartsCardProps {
  machineId: string
  canEdit: boolean
}

export function MachineSparePartsCard({ machineId, canEdit }: MachineSparePartsCardProps) {
  const [lines, setLines] = useState<MachineSparePartLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<SparePartSearchRow[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [mutatingId, setMutatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/machines/${machineId}/spare-parts`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? "โหลดรายการไม่สำเร็จ")
      setLines(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }, [machineId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!pickerOpen) return

    const q = search.trim()
    const url =
      q.length >= 1
        ? `/api/spare-parts?search=${encodeURIComponent(q)}&pageSize=50`
        : `/api/spare-parts?pageSize=50`

    const delay = q.length >= 1 ? 300 : 0
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(url)
        const json = await res.json()
        if (res.ok) setSearchResults(json.data ?? [])
        else setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, delay)

    return () => clearTimeout(t)
  }, [search, pickerOpen])

  const linkedIds = new Set(lines.map((l) => l.partId))

  const addPart = async (partId: string) => {
    setAddingId(partId)
    setError(null)
    try {
      const res = await fetch(`/api/machines/${machineId}/spare-parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg =
          typeof json.error === "string" ? json.error : json.error?.message ?? "เพิ่มไม่สำเร็จ"
        throw new Error(msg)
      }
      await load()
      setPickerOpen(false)
      setSearch("")
      setSearchResults([])
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ")
    } finally {
      setAddingId(null)
    }
  }

  const removeLine = async (lineId: string) => {
    if (!confirm("ลบอะไหล่นี้ออกจากรายการเครื่อง?")) return
    setMutatingId(lineId)
    try {
      const res = await fetch(`/api/machines/${machineId}/spare-parts/${lineId}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "ลบไม่สำเร็จ")
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ")
    } finally {
      setMutatingId(null)
    }
  }

  const patchLine = async (
    lineId: string,
    body: {
      sortOrder?: number
      qtyRecommended?: number
      note?: string | null
      installPhotoUrl?: string | null
      locationOnMachine?: string | null
    }
  ) => {
    setMutatingId(lineId)
    try {
      const res = await fetch(`/api/machines/${machineId}/spare-parts/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? "บันทึกไม่สำเร็จ")
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ")
    } finally {
      setMutatingId(null)
    }
  }

  const ordered = [...lines].sort((x, y) => x.sortOrder - y.sortOrder || x.id.localeCompare(y.id))

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= ordered.length) return
    const a = ordered[index]
    const b = ordered[next]
    setError(null)
    setMutatingId(a.id)
    try {
      const r1 = await fetch(`/api/machines/${machineId}/spare-parts/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      })
      if (!r1.ok) throw new Error((await r1.json()).error ?? "สลับลำดับไม่สำเร็จ")
      const r2 = await fetch(`/api/machines/${machineId}/spare-parts/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      })
      if (!r2.ok) throw new Error((await r2.json()).error ?? "สลับลำดับไม่สำเร็จ")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "สลับลำดับไม่สำเร็จ")
    } finally {
      setMutatingId(null)
    }
  }

  const sorted = ordered

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 min-w-0 flex-1">
            <Package className="w-5 h-5 text-slate-500 shrink-0" />
            <span className="truncate">อะไหล่แนะนำ (BOM)</span>
          </CardTitle>
          {canEdit ? (
            <div className="shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="gap-1.5">
                <Plus className="w-4 h-4" />
                เพิ่มอะไหล่
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <div className="px-6 pb-6">
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              กำลังโหลด…
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-6 space-y-2 px-1">
              <p>ยังไม่มีรายการอะไหล่ที่ผูกกับเครื่องนี้</p>
              {canEdit ? (
                <p className="text-slate-400">
                  กดปุ่ม <span className="font-medium text-slate-600">เพิ่มอะไหล่</span> ที่มุมขวาของหัวข้อการ์ดด้านบน
                  แล้วค้นหาอะไหล่จากคลังเพื่อผูกกับเครื่อง
                </p>
              ) : (
                <p className="text-slate-400">
                  บัญชีของคุณไม่มีสิทธิ์แก้ไขเครื่องในสาขานี้ — จึงไม่มีปุ่มเพิ่ม
                  ให้ผู้จัดการหรือแอดมิน (สิทธิ์แก้ไขเครื่อง) ช่วยเพิ่มรายการให้
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {sorted.map((row, idx) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <div className="flex gap-3 items-start">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-white">
                      {row.part.imageUrl ? (
                        <ClickableImage
                          src={row.part.imageUrl}
                          alt={row.part.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {row.part.code} — {row.part.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {row.part.supplier ? row.part.supplier.name : "—"} · หน่วย {row.part.unit}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          จำนวนอ้างอิง
                          <Input
                            type="number"
                            min={1}
                            className="h-8 w-16 text-xs"
                            disabled={!canEdit || mutatingId === row.id}
                            defaultValue={row.qtyRecommended}
                            key={`${row.id}-qty-${row.qtyRecommended}`}
                            onBlur={(e) => {
                              const v = parseInt(e.target.value, 10)
                              if (!Number.isFinite(v) || v < 1) return
                              if (v !== row.qtyRecommended) void patchLine(row.id, { qtyRecommended: v })
                            }}
                          />
                        </label>
                        <Input
                          placeholder="หมายเหตุ"
                          className="h-8 max-w-xs text-xs flex-1 min-w-[120px]"
                          disabled={!canEdit || mutatingId === row.id}
                          defaultValue={row.note ?? ""}
                          key={`${row.id}-note-${row.note ?? ""}`}
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null
                            if (v !== (row.note ?? "")) void patchLine(row.id, { note: v })
                          }}
                        />
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          title="ขึ้น"
                          disabled={idx === 0 || mutatingId === row.id}
                          onClick={() => move(idx, -1)}
                          className="p-1 text-slate-500 hover:bg-white rounded border border-transparent hover:border-slate-200 disabled:opacity-30"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="ลง"
                          disabled={idx === sorted.length - 1 || mutatingId === row.id}
                          onClick={() => move(idx, 1)}
                          className="p-1 text-slate-500 hover:bg-white rounded border border-transparent hover:border-slate-200 disabled:opacity-30"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="ลบ"
                          disabled={mutatingId === row.id}
                          onClick={() => removeLine(row.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {(canEdit || row.locationOnMachine || row.installPhotoUrl) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-600">
                          ตำแหน่งบนเครื่อง / จุดติดตั้งอะไหล่
                        </label>
                        <textarea
                          className="w-full min-h-[72px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                          placeholder="เช่น ฝาครอบมอเตอร์ด้านขวา, วาล์วไฮดรอลิกชุด A"
                          disabled={!canEdit || mutatingId === row.id}
                          defaultValue={row.locationOnMachine ?? ""}
                          key={`${row.id}-loc-${row.locationOnMachine ?? ""}`}
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null
                            if (v !== (row.locationOnMachine ?? "")) {
                              void patchLine(row.id, { locationOnMachine: v })
                            }
                          }}
                        />
                      </div>
                      <div>
                        <ImageUpload
                          label="รูปตำแหน่งติดตั้ง (บนเครื่อง)"
                          previewHeightClass="h-32"
                          value={row.installPhotoUrl ?? ""}
                          disabled={!canEdit || mutatingId === row.id}
                          key={`${row.id}-install-${row.installPhotoUrl ?? ""}`}
                          onChange={(url) => {
                            const next = url || null
                            if (next !== (row.installPhotoUrl ?? null)) {
                              void patchLine(row.id, { installPhotoUrl: next })
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">เลือกอะไหล่จากคลัง</h2>
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                onClick={() => {
                  setPickerOpen(false)
                  setSearch("")
                  setSearchResults([])
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="ค้นหารหัสหรือชื่ออะไหล่…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                แสดงอะไหล่ในระบบล่าสุด — พิมพ์เพื่อค้นหารหัสหรือชื่อ
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
              {searchLoading ? (
                <div className="flex justify-center py-8 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center text-sm text-slate-400 py-8 space-y-2 px-2">
                  <p>
                    {search.trim().length >= 1
                      ? "ไม่พบอะไหล่ที่ตรงกับคำค้น"
                      : "ยังไม่มีอะไหล่ในระบบสำหรับบริษัทนี้"}
                  </p>
                  <p className="text-xs">
                    เพิ่มอะไหล่ได้ที่เมนู <span className="font-medium text-slate-600">อะไหล่</span> →{" "}
                    <span className="font-medium text-slate-600">เพิ่มอะไหล่</span> (/spare-parts/new)
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {searchResults.map((p) => {
                    const already = linkedIds.has(p.id)
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={already || addingId === p.id}
                          onClick={() => !already && addPart(p.id)}
                          className="w-full flex gap-3 p-2 rounded-lg text-left hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-slate-200"
                        >
                          <div className="relative w-10 h-10 rounded border border-slate-200 overflow-hidden shrink-0 bg-slate-100">
                            {p.imageUrl ? (
                              <Image src={p.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {p.code} — {p.name}
                            </p>
                            <p className="text-xs text-slate-500">{p.supplier?.name ?? "—"}</p>
                            {already && <span className="text-xs text-amber-600">มีในรายการแล้ว</span>}
                          </div>
                          {addingId === p.id && <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-2" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
