"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Shield, Plus, Trash2, Pencil, X } from "lucide-react"
import { ShiftType } from "@/types"
import { toast } from "sonner"

interface StaffingRule {
  id: string
  name: string
  description: string | null
  shiftType: ShiftType
  minWorkers: number
  positionType: string | null
  isActive: boolean
  crew: { name: string } | null
}

const SHIFT_TYPES = [
  { value: "DAY", label: "Day Shift" },
  { value: "NIGHT", label: "Night Shift" },
  { value: "CUSTOM", label: "Custom" },
]

const POSITION_TYPES = [
  { value: "", label: "Any Position" },
  { value: "OPERATOR", label: "Operator" },
  { value: "ONSHORE_CONTROL_ROOM", label: "Onshore Control Room" },
  { value: "OTHER", label: "Other" },
]

export function StaffingRulesCard() {
  const [rules, setRules] = useState<StaffingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newRule, setNewRule] = useState({
    name: "",
    shiftType: "DAY",
    minWorkers: 1,
    positionType: "",
    isActive: true,
  })

  useEffect(() => {
    fetchRules()
  }, [])

  async function fetchRules() {
    try {
      const response = await fetch("/api/staffing-rules")
      const data = await response.json()
      if (data.success) {
        setRules(data.data)
      }
    } catch (error) {
      console.error("Failed to fetch staffing rules", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!newRule.name) {
      toast.error("Rule name is required")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/staffing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRule,
          positionType: newRule.positionType || undefined,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success("Staffing rule created")
        setRules([...rules, data.data])
        setShowForm(false)
        setNewRule({
          name: "",
          shiftType: "DAY",
          minWorkers: 1,
          positionType: "",
          isActive: true,
        })
      } else {
        toast.error(data.error || "Failed to create rule")
      }
    } catch (error) {
      toast.error("Failed to create rule")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    // Note: We'd need a DELETE endpoint for this
    toast.error("Deletion not yet implemented in API")
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Staffing Rules
            </CardTitle>
            <CardDescription>Configure minimum staffing requirements</CardDescription>
          </div>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Rule
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">New Staffing Rule</h4>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input 
                  value={newRule.name} 
                  onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g., Minimum Night Operators" 
                />
              </div>
              <div className="space-y-2">
                <Label>Shift Type</Label>
                <Select
                  value={newRule.shiftType}
                  onChange={e => setNewRule({ ...newRule, shiftType: e.target.value })}
                  options={SHIFT_TYPES}
                />
              </div>
              <div className="space-y-2">
                <Label>Required Workers</Label>
                <Input 
                  type="number" 
                  min={1} 
                  value={newRule.minWorkers} 
                  onChange={e => setNewRule({ ...newRule, minWorkers: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Position Requirement</Label>
                <Select
                  value={newRule.positionType}
                  onChange={e => setNewRule({ ...newRule, positionType: e.target.value })}
                  options={POSITION_TYPES}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Create Rule"}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between p-3 rounded border">
              <div>
                <p className="font-medium">{rule.name}</p>
                <p className="text-sm text-muted-foreground">
                  Requires <strong>{rule.minWorkers}</strong> {rule.positionType ? rule.positionType.toLowerCase().replace(/_/g, ' ') + 's' : 'workers'} 
                  {' '}on <strong>{rule.shiftType}</strong> shift
                </p>
              </div>
              <div className="flex gap-1">
                {/* Edit/Delete buttons could go here */}
              </div>
            </div>
          ))}
          {rules.length === 0 && !loading && (
            <p className="text-center text-muted-foreground py-4">No specific staffing rules configured</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
