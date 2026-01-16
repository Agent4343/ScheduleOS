"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LayoutGrid, Plus, Pencil, Trash2 } from "lucide-react"
import type { Position } from "../settings-types"

interface PositionsCardProps {
  positions: Position[]
  isAdmin: boolean
  onAddPosition: () => void
  onEditPosition: (position: Position) => void
  onDeletePosition: (position: Position) => void
}

export function PositionsCard({
  positions,
  isAdmin,
  onAddPosition,
  onEditPosition,
  onDeletePosition,
}: PositionsCardProps) {
  // Group positions by category
  const positionsByCategory = useMemo(() => {
    return positions.reduce(
      (acc, pos) => {
        const cat = pos.category || "Other"
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(pos)
        return acc
      },
      {} as Record<string, Position[]>
    )
  }, [positions])

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" />
              Positions
            </CardTitle>
            <CardDescription>Configure staffing positions and requirements</CardDescription>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={onAddPosition}>
              <Plus className="h-4 w-4 mr-1" />
              Add Position
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No positions configured yet. Add positions to track staffing requirements.
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(positionsByCategory).map(([category, categoryPositions]) => (
              <div key={category}>
                <h4 className="font-semibold text-sm text-muted-foreground mb-2">{category}</h4>
                <div className="space-y-2">
                  {categoryPositions
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((position) => (
                      <PositionRow
                        key={position.id}
                        position={position}
                        isAdmin={isAdmin}
                        onEdit={onEditPosition}
                        onDelete={onDeletePosition}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Sub-component for individual position row
interface PositionRowProps {
  position: Position
  isAdmin: boolean
  onEdit: (position: Position) => void
  onDelete: (position: Position) => void
}

function PositionRow({ position, isAdmin, onEdit, onDelete }: PositionRowProps) {
  const shiftTypeLabel =
    position.shiftType === "24hr"
      ? "24-Hour"
      : position.shiftType === "day"
        ? "Day Shift"
        : "Night Shift"

  return (
    <div className="flex items-center justify-between p-3 rounded border hover:bg-muted/50">
      <div>
        <p className="font-medium">
          {position.name}
          {position.code && (
            <span className="text-muted-foreground ml-2">({position.code})</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {shiftTypeLabel} • Min: {position.minStaffing} / Max: {position.maxStaffing}
        </p>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(position)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(position)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
