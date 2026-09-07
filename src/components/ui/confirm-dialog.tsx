"use client"

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Promise-based confirmation, replacing window.confirm()/prompt():
 *
 *   const confirm = useConfirm()
 *   if (await confirm({ title: "Delete crew?", description: "…", destructive: true })) { … }
 *
 * `typeToConfirm: "DELETE"` requires the user to type that word.
 */

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  typeToConfirm?: string
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [typed, setTyped] = useState("")
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setTyped("")
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  const typeOk = !options?.typeToConfirm || typed === options.typeToConfirm

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal isOpen onClose={() => close(false)} title={options.title}>
          <div className="space-y-4">
            {options.description && <div className="text-sm text-muted-foreground">{options.description}</div>}
            {options.typeToConfirm && (
              <div className="space-y-1">
                <label htmlFor="confirm-typed" className="text-sm">
                  Type <span className="font-mono font-semibold">{options.typeToConfirm}</span> to confirm
                </label>
                <Input
                  id="confirm-typed"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                  autoComplete="off"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => close(false)}>
                {options.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                type="button"
                variant={options.destructive ? "destructive" : "default"}
                disabled={!typeOk}
                onClick={() => close(true)}
                autoFocus={!options.typeToConfirm}
              >
                {options.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>")
  return ctx
}
