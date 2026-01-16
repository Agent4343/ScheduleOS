"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"
import { INITIAL_PATTERN_FORM } from "../settings-constants"
import type { RotationPattern, NewPatternForm } from "../settings-types"

interface RotationPatternsCardProps {
  patterns: RotationPattern[]
  isAdmin: boolean
  onCreatePattern: (pattern: NewPatternForm) => Promise<boolean>
}

export function RotationPatternsCard({
  patterns,
  isAdmin,
  onCreatePattern,
}: RotationPatternsCardProps) {
  const [showNewPattern, setShowNewPattern] = useState(false)
  const [newPattern, setNewPattern] = useState<NewPatternForm>(INITIAL_PATTERN_FORM)
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    setCreating(true)
    const success = await onCreatePattern(newPattern)
    if (success) {
      setShowNewPattern(false)
      setNewPattern(INITIAL_PATTERN_FORM)
    }
    setCreating(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Rotation Patterns
            </CardTitle>
            <CardDescription>Configure shift rotation patterns</CardDescription>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewPattern(!showNewPattern)}
            >
              {showNewPattern ? "Cancel" : "+ Add Pattern"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Pattern Form */}
        {showNewPattern && (
          <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
            <h4 className="font-semibold">Create New Rotation Pattern</h4>

            <div className="space-y-2">
              <Label htmlFor="patternName">Pattern Name</Label>
              <Input
                id="patternName"
                placeholder="e.g., 3 weeks on / 3 weeks off"
                value={newPattern.name}
                onChange={(e) => setNewPattern({ ...newPattern, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="daysOn">Days On</Label>
                <Input
                  id="daysOn"
                  type="number"
                  min={1}
                  value={newPattern.daysOn}
                  onChange={(e) =>
                    setNewPattern({ ...newPattern, daysOn: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daysOff">Days Off</Label>
                <Input
                  id="daysOff"
                  type="number"
                  min={1}
                  value={newPattern.daysOff}
                  onChange={(e) =>
                    setNewPattern({ ...newPattern, daysOff: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <input
                type="checkbox"
                id="includesNights"
                checked={newPattern.includesNights}
                onChange={(e) =>
                  setNewPattern({ ...newPattern, includesNights: e.target.checked })
                }
                className="h-5 w-5 rounded"
              />
              <Label htmlFor="includesNights" className="cursor-pointer">
                Alternates Days/Nights
              </Label>
            </div>

            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? "Creating..." : "Create Pattern"}
            </Button>
          </div>
        )}

        {/* Existing Patterns */}
        <div className="space-y-2">
          {patterns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No patterns yet</p>
          ) : (
            patterns.map((pattern) => (
              <div
                key={pattern.id}
                className="flex items-center justify-between p-3 rounded border"
              >
                <div>
                  <p className="font-medium">{pattern.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {pattern.daysOn} on / {pattern.daysOff} off
                    {pattern.includesNights && " • Day/Night"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pattern.isDefault && <Badge variant="secondary">Default</Badge>}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
