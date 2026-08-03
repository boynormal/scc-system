"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react"

export const CONFIRM_WORD = "ยืนยัน"

export type TypeConfirmOptions = {
  title?: string
  message: string
}

type TypeConfirmFn = (options: TypeConfirmOptions) => Promise<boolean>

const TypeConfirmContext = createContext<TypeConfirmFn | null>(null)

type Pending = {
  options: TypeConfirmOptions
  resolve: (value: boolean) => void
}

export function TypeConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [typed, setTyped] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descId = useId()

  const confirmType = useCallback<TypeConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setTyped("")
      setPending({ options, resolve })
    })
  }, [])

  const close = useCallback(
    (value: boolean) => {
      pending?.resolve(value)
      setPending(null)
      setTyped("")
    },
    [pending]
  )

  useEffect(() => {
    if (!pending) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("keydown", onKey)
    }
  }, [pending, close])

  const canConfirm = typed.trim() === CONFIRM_WORD

  return (
    <TypeConfirmContext.Provider value={confirmType}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
          >
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {pending.options.title ?? "ยืนยันการลบ"}
            </h2>
            <p id={descId} className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {pending.options.message}
            </p>
            <p className="mt-3 text-sm text-foreground">
              พิมพ์ <span className="font-semibold text-red-600 dark:text-red-400">{CONFIRM_WORD}</span>{" "}
              เพื่อยืนยัน
            </p>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm) close(true)
              }}
              autoComplete="off"
              placeholder={CONFIRM_WORD}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/60"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={() => close(true)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </TypeConfirmContext.Provider>
  )
}

export function useTypeConfirm(): TypeConfirmFn {
  const ctx = useContext(TypeConfirmContext)
  if (!ctx) {
    throw new Error("useTypeConfirm must be used within TypeConfirmProvider")
  }
  return ctx
}
