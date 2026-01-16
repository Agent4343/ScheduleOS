"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import { CATEGORY_OPTIONS, SHIFT_TYPE_OPTIONS, INITIAL_POSITION_FORM } from "../settings-constants"
import type { Position, PositionForm } from "../settings-types"

interface PositionModalProps {
  isOpen: boolean
  editingPosition: Position | null
  onClose: () => void
  onSaved: () => void
  onMessage: (message: string) => void
}

export function PositionModal({
  isOpen,
  editingPosition,
  onClose,
  onSaved,
  onMessage,
}: PositionModalProps) {
  const [positionForm, setPositionForm] = useState<PositionForm>(INITIAL_POSITION_FORM)
  const [saving, setSaving] = useState(false)

  // Reset form when modal opens or editing position changes
  useEffect(() => {
    if (isOpen) {
      if (editingPosition) {
        setPositionForm({
          name: editingPosition.name,
          code: editingPosition.code || "",
          category: editingPosition.category || "Field Ops",
          shiftType: editingPosition.shiftType,
          minStaffing: editingPosition.minStaffing,
          maxStaffing: editingPosition.maxStaffing,
          sortOrder: editingPosition.sortOrder,
        })
      } else {
        setPositionForm(INITIAL_POSITION_FORM)
      }
    }
  }, [isOpen, editingPosition])

  async function handleSave() {
    if (!positionForm.name) {
      onMessage("Position name is required")
      return
    }

    setSaving(true)

    try {
      const url = editingPosition
        ? `/api/positions/${editingPosition.id}`
        : "/api/positions"
      const method = editingPosition ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: positionForm.name,
          code: positionForm.code || null,
          category: positionForm.category,
          shiftType: positionForm.shiftType,
          minStaffing: positionForm.minStaffing,
          maxStaffing: positionForm.maxStaffing,
          sortOrder: positionForm.sortOrder,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        onMessage(editingPosition ? "Position updated!" : "Position created!")
        onSaved()
        onClose()
      } else {
        onMessage(data.error || "Failed to save position")
      }
    } catch (error) {
      console.error("Failed to save position:", error)
      onMessage("Failed to save position")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingPosition ? "Edit Position" : "Add Position"}
      description="Configure position details and staffing requirements"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="posName">Position Name *</Label>
          <Input
            id="posName"
            value={positionForm.name}
            onChange={(e) => setPositionForm({ ...positionForm, name: e.target.value })}
            placeholder="e.g., Production Lead - Days"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="posCode">Code (Optional)</Label>
            <Input
              id="posCode"
              value={positionForm.code}
              onChange={(e) => setPositionForm({ ...positionForm, code: e.target.value })}
              placeholder="e.g., PL-D"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="posCategory">Category</Label>
            <Select
              value={positionForm.category}
              onChange={(e) => setPositionForm({ ...positionForm, category: e.target.value })}
              options={CATEGORY_OPTIONS}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="posShiftType">Shift Type</Label>
          <Select
            value={positionForm.shiftType}
            onChange={(e) => setPositionForm({ ...positionForm, shiftType: e.target.value })}
            options={SHIFT_TYPE_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="posMin">Min Staffing</Label>
            <Input
              id="posMin"
              type="number"
              min={0}
              value={positionForm.minStaffing}
              onChange={(e) =>
                setPositionForm({ ...positionForm, minStaffing: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="posMax">Max Staffing</Label>
            <Input
              id="posMax"
              type="number"
              min={1}
              value={positionForm.maxStaffing}
              onChange={(e) =>
                setPositionForm({ ...positionForm, maxStaffing: parseInt(e.target.value) || 1 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="posSortOrder">Sort Order</Label>
            <Input
              id="posSortOrder"
              type="number"
              value={positionForm.sortOrder}
              onChange={(e) =>
                setPositionForm({ ...positionForm, sortOrder: parseInt(e.target.value) || 0 })
              }
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : editingPosition ? "Update Position" : "Create Position"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
