"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Lightweight toasts. `const toast = useToast()` then
 * `toast.success("Saved")`, `toast.error("Could not save")`, `toast.info(...)`.
 * Replaces window.alert() for non-blocking feedback.
 */

type Kind = "success" | "error" | "info"

interface ToastItem {
  id: number
  kind: Kind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const ICONS: Record<Kind, typeof Info> = { success: CheckCircle2, error: AlertCircle, info: Info }
const STYLES: Record<Kind, string> = {
  success: "border-green-500/40 text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-950",
  error: "border-red-500/40 text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-950",
  info: "border-blue-500/40 text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-950",
}
const DURATION_MS: Record<Kind, number> = { success: 3500, info: 4500, error: 7000 }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: Kind, message: string) => {
      const id = nextId.current++
      setItems((prev) => [...prev.slice(-4), { id, kind, message }])
      window.setTimeout(() => dismiss(id), DURATION_MS[kind])
    },
    [dismiss]
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {items.map((t) => {
          const Icon = ICONS[t.kind]
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-md",
                STYLES[t.kind]
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider> (see components/providers.tsx)")
  }
  return ctx
}
