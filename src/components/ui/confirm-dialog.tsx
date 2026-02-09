"use client"

import * as React from "react"
import { Modal } from "./modal"
import { Button } from "./button"
import { AlertTriangle } from "lucide-react"

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "warning" | "default"
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  const variantStyles = {
    danger: {
      icon: "bg-red-100 text-red-600",
      button: "bg-red-600 hover:bg-red-700 text-white",
    },
    warning: {
      icon: "bg-yellow-100 text-yellow-600",
      button: "bg-yellow-600 hover:bg-yellow-700 text-white",
    },
    default: {
      icon: "bg-blue-100 text-blue-600",
      button: "bg-primary hover:bg-primary/90 text-primary-foreground",
    },
  }

  const styles = variantStyles[variant]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="flex flex-col items-center text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${styles.icon}`}>
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6">{description}</p>
        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            className={`flex-1 ${styles.button}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// Hook for easier usage
export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    isOpen: boolean
    title: string
    description: string
    onConfirm: () => void | Promise<void>
    variant: "danger" | "warning" | "default"
    confirmText: string
    isLoading: boolean
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "default",
    confirmText: "Confirm",
    isLoading: false,
  })

  const confirm = React.useCallback(
    (options: {
      title: string
      description: string
      onConfirm: () => void | Promise<void>
      variant?: "danger" | "warning" | "default"
      confirmText?: string
    }) => {
      setState({
        isOpen: true,
        title: options.title,
        description: options.description,
        onConfirm: options.onConfirm,
        variant: options.variant || "default",
        confirmText: options.confirmText || "Confirm",
        isLoading: false,
      })
    },
    []
  )

  const handleConfirm = React.useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }))
    try {
      await state.onConfirm()
    } finally {
      setState((prev) => ({ ...prev, isOpen: false, isLoading: false }))
    }
  }, [state.onConfirm])

  const handleClose = React.useCallback(() => {
    if (!state.isLoading) {
      setState((prev) => ({ ...prev, isOpen: false }))
    }
  }, [state.isLoading])

  const ConfirmDialogComponent = React.useCallback(
    () => (
      <ConfirmDialog
        isOpen={state.isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={state.title}
        description={state.description}
        variant={state.variant}
        confirmText={state.confirmText}
        isLoading={state.isLoading}
      />
    ),
    [state, handleClose, handleConfirm]
  )

  return { confirm, ConfirmDialog: ConfirmDialogComponent }
}
