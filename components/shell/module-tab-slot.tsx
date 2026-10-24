"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

const ModuleTabSlotContext = createContext<HTMLElement | null>(null)
const ModuleTabSlotSetterContext = createContext<(node: HTMLElement | null) => void>(() => {})

export function ModuleTabSlotProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const setSlot = useCallback((node: HTMLElement | null) => {
    setTarget(node)
  }, [])

  return (
    <ModuleTabSlotSetterContext.Provider value={setSlot}>
      <ModuleTabSlotContext.Provider value={target}>{children}</ModuleTabSlotContext.Provider>
    </ModuleTabSlotSetterContext.Provider>
  )
}

export function ModuleTabSlotTarget({ className }: { className?: string }) {
  const setSlot = useContext(ModuleTabSlotSetterContext)
  return <div ref={setSlot} className={className} />
}

export function ModuleTabPortal({ children }: { children: ReactNode }) {
  const target = useContext(ModuleTabSlotContext)
  if (!target) return null
  return createPortal(children, target)
}
