"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import {
  Users2,
  Plus,
  Users,
  Calendar,
  Settings,
  MoreVertical,
  RefreshCw,
  Pencil,
  Trash2,
} from "lucide-react"

interface Crew {
  id: string
  name: string
  description: string | null
  color: string
  currentPhase: number
  rotationPattern: {
    id: string
    name: string
    daysOn: number
    daysOff: number
  } | null
  _count: {
    workers: number
  }
}

interface RotationPattern {
  id: string
  name: string
  daysOn: number
  daysOff: number
  includesNights: boolean
}

const COLORS = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Orange" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EF4444", label: "Red" },
  { value: "#EC4899", label: "Pink" },
  { value: "#14B8A6", label: "Teal" },
  { value: "#6366F1", label: "Indigo" },
]

export default function CrewsPage() {
  const [crews, setCrews] = useState<Crew[]>([])
  const [patterns, setPatterns] = useState<RotationPattern[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    rotationPatternId: "",
  })
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    rotationPatternId: "",
    currentPhase: 0,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [crewsRes, patternsRes] = await Promise.all([
          fetch("/api/crews"),
          fetch("/api/rotation-patterns"),
        ])

        const crewsData = await crewsRes.json()
        const patternsData = await patternsRes.json()

        if (crewsData.success) setCrews(crewsData.data)
        if (patternsData.success) setPatterns(patternsData.data)
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function openEditModal(crew: Crew) {
    setEditingCrew(crew)
    setEditFormData({
      name: crew.name,
      description: crew.description || "",
      color: crew.color,
      rotationPatternId: crew.rotationPattern?.id || "",
      currentPhase: crew.currentPhase,
    })
    setIsEditModalOpen(true)
    setOpenMenuId(null)
  }

  async function handleUpdateCrew(e: React.FormEvent) {
    e.preventDefault()
    if (!editingCrew) return
    setSubmitting(true)

    try {
      const response = await fetch(`/api/crews/${editingCrew.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editFormData.name,
          description: editFormData.description || null,
          color: editFormData.color,
          rotationPatternId: editFormData.rotationPatternId || null,
          currentPhase: editFormData.currentPhase,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setCrews((prev) =>
          prev.map((c) => (c.id === editingCrew.id ? data.data : c))
        )
        setIsEditModalOpen(false)
        setEditingCrew(null)
      } else {
        alert(data.error || "Failed to update crew")
      }
    } catch (error) {
      console.error("Failed to update crew:", error)
      alert("Failed to update crew")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteCrew(crewId: string) {
    if (!confirm("Are you sure you want to delete this crew? This action cannot be undone.")) {
      return
    }
    setOpenMenuId(null)

    try {
      const response = await fetch(`/api/crews/${crewId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        setCrews((prev) => prev.filter((c) => c.id !== crewId))
      } else {
        alert(data.error || "Failed to delete crew")
      }
    } catch (error) {
      console.error("Failed to delete crew:", error)
      alert("Failed to delete crew")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch("/api/crews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          rotationPatternId: formData.rotationPatternId || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setCrews((prev) => [...prev, data.data])
        setIsModalOpen(false)
        setFormData({
          name: "",
          description: "",
          color: "#3B82F6",
          rotationPatternId: "",
        })
      } else {
        alert(data.error || "Failed to create crew")
      }
    } catch (error) {
      console.error("Failed to create crew:", error)
      alert("Failed to create crew")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGenerateSchedule(crewId: string) {
    const crew = crews.find((c) => c.id === crewId)
    if (!crew?.rotationPattern) {
      alert("Please assign a rotation pattern to this crew first")
      return
    }

    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 3) // Generate 3 months

    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewId,
          patternId: crew.rotationPattern.id,
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
          startPhase: crew.currentPhase,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`Schedule generated: ${data.message}`)
      } else {
        alert(data.error || "Failed to generate schedule")
      }
    } catch (error) {
      console.error("Failed to generate schedule:", error)
      alert("Failed to generate schedule")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Crews</h1>
          <p className="text-muted-foreground">
            Manage your crew rotations ({crews.length} crews)
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Crew
        </Button>
      </div>

      {/* Crews grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : crews.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No crews yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first crew to start organizing your workforce
            </p>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Crew
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {crews.map((crew) => (
            <Card key={crew.id} className="relative overflow-hidden">
              <div
                className="absolute top-0 left-0 w-full h-1"
                style={{ backgroundColor: crew.color }}
              />
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: crew.color }}
                    >
                      {crew.name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{crew.name}</CardTitle>
                      <CardDescription>{crew.description || "No description"}</CardDescription>
                    </div>
                  </div>
                  <div className="relative" ref={openMenuId === crew.id ? menuRef : null}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setOpenMenuId(openMenuId === crew.id ? null : crew.id)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    {openMenuId === crew.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-background border rounded-md shadow-lg z-10">
                        <button
                          className="w-full px-3 py-3 text-left text-sm hover:bg-muted flex items-center gap-2 min-h-[44px]"
                          onClick={() => openEditModal(crew)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          className="w-full px-3 py-3 text-left text-sm hover:bg-muted flex items-center gap-2 min-h-[44px]"
                          onClick={() => {
                            openEditModal(crew)
                          }}
                        >
                          <Settings className="h-4 w-4" />
                          Configure
                        </button>
                        <button
                          className="w-full px-3 py-3 text-left text-sm hover:bg-muted flex items-center gap-2 text-red-600 min-h-[44px]"
                          onClick={() => handleDeleteCrew(crew.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Workers</span>
                  </div>
                  <Badge variant="secondary">{crew._count.workers}</Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Pattern</span>
                  </div>
                  {crew.rotationPattern ? (
                    <Badge>
                      {crew.rotationPattern.daysOn}/{crew.rotationPattern.daysOff}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">Not set</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Settings className="h-4 w-4" />
                    <span>Current Phase</span>
                  </div>
                  <span className="font-mono">Day {crew.currentPhase + 1}</span>
                </div>

                <div className="pt-2 border-t flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleGenerateSchedule(crew.id)}
                    disabled={!crew.rotationPattern}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Generate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditModal(crew)}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Crew Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Crew"
        description="Create a new crew for shift rotations"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Crew Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Crew A, Night Shift"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label>Crew Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, color: color.value }))}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    formData.color === color.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pattern">Rotation Pattern</Label>
            <Select
              value={formData.rotationPatternId}
              onChange={(e) => setFormData((prev) => ({ ...prev, rotationPatternId: e.target.value }))}
              options={[
                { value: "", label: "Select a pattern" },
                ...patterns.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.daysOn} on / ${p.daysOff} off)`,
                })),
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Crew"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Crew Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingCrew(null)
        }}
        title="Edit Crew"
        description="Update crew settings and configuration"
      >
        <form onSubmit={handleUpdateCrew} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Crew Name *</Label>
            <Input
              id="edit-name"
              value={editFormData.name}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Crew A, Night Shift"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              value={editFormData.description}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label>Crew Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setEditFormData((prev) => ({ ...prev, color: color.value }))}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    editFormData.color === color.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-pattern">Rotation Pattern</Label>
            <Select
              value={editFormData.rotationPatternId}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, rotationPatternId: e.target.value }))}
              options={[
                { value: "", label: "No pattern" },
                ...patterns.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.daysOn} on / ${p.daysOff} off)`,
                })),
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phase">Current Phase (Day in rotation)</Label>
            <Input
              id="edit-phase"
              type="number"
              min="0"
              value={editFormData.currentPhase}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, currentPhase: parseInt(e.target.value) || 0 }))}
            />
            <p className="text-xs text-muted-foreground">
              Day 0 = first day of rotation cycle
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => {
              setIsEditModalOpen(false)
              setEditingCrew(null)
            }}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
