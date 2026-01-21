"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select } from "@/components/ui/select"
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  AlertTriangle,
  Award,
  Briefcase,
  Sun,
  Moon,
} from "lucide-react"

interface PositionCategory {
  id: string
  name: string
  code: string
  description: string | null
  isOffshore: boolean
  sortOrder: number
  isActive: boolean
  _count: {
    users: number
    staffingRequirements: number
  }
  staffingRequirements: {
    id: string
    shiftType: string
    minRequired: number
    idealCount: number | null
  }[]
}

interface Certification {
  id: string
  name: string
  code: string
  description: string | null
  isRequired: boolean
  validityDays: number | null
  isActive: boolean
  _count: {
    userCertifications: number
  }
}

interface Worker {
  id: string
  name: string | null
  position: string | null
  positionCategory: {
    id: string
    name: string
    code: string
  } | null
}

interface StaffingStatus {
  positionCategoryId: string
  positionCategoryName: string
  shiftType: string
  minRequired: number
  currentCount: number
  isMet: boolean
  workers: { id: string; name: string | null }[]
}

export default function StaffingPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")

  // Position categories state
  const [positionCategories, setPositionCategories] = useState<PositionCategory[]>([])
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<PositionCategory | null>(null)
  const [savingCategory, setSavingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState({
    name: "",
    code: "",
    description: "",
    isOffshore: false,
  })

  // Staffing requirements state
  const [showRequirementForm, setShowRequirementForm] = useState(false)
  const [savingRequirement, setSavingRequirement] = useState(false)
  const [newRequirement, setNewRequirement] = useState({
    positionCategoryId: "",
    shiftType: "DAY",
    minRequired: 1,
    idealCount: "",
  })

  // Certifications state
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [showCertForm, setShowCertForm] = useState(false)
  const [editingCert, setEditingCert] = useState<Certification | null>(null)
  const [savingCert, setSavingCert] = useState(false)
  const [newCert, setNewCert] = useState({
    name: "",
    code: "",
    description: "",
    isRequired: false,
    validityDays: "",
  })

  // Workers state for assignment
  const [workers, setWorkers] = useState<Worker[]>([])

  // Today's staffing status
  const [staffingStatus, setStaffingStatus] = useState<StaffingStatus[]>([])

  const isAdmin = session?.user?.role === "ADMIN"
  const canEdit = ["ADMIN", "SUPERVISOR"].includes(session?.user?.role || "")

  const showMessage = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(""), 3000)
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [categoriesRes, certsRes, workersRes, staffingRes] = await Promise.all([
        fetch("/api/position-categories"),
        fetch("/api/certifications"),
        fetch("/api/users?status=ACTIVE"),
        fetch(`/api/staffing-requirements?date=${new Date().toISOString().split("T")[0]}`),
      ])

      const [categoriesData, certsData, workersData, staffingData] = await Promise.all([
        categoriesRes.json(),
        certsRes.json(),
        workersRes.json(),
        staffingRes.json(),
      ])

      if (categoriesData.success) setPositionCategories(categoriesData.data)
      if (certsData.success) setCertifications(certsData.data)
      if (workersData.success) setWorkers(workersData.data)
      if (staffingData.success && staffingData.staffingStatus) {
        setStaffingStatus(staffingData.staffingStatus)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Position Category handlers
  const resetCategoryForm = () => {
    setNewCategory({ name: "", code: "", description: "", isOffshore: false })
    setEditingCategory(null)
    setShowCategoryForm(false)
  }

  const startEditCategory = (category: PositionCategory) => {
    setEditingCategory(category)
    setNewCategory({
      name: category.name,
      code: category.code,
      description: category.description || "",
      isOffshore: category.isOffshore,
    })
    setShowCategoryForm(true)
  }

  const handleSaveCategory = async () => {
    if (!newCategory.name.trim() || !newCategory.code.trim()) {
      showMessage("Name and code are required", "error")
      return
    }

    setSavingCategory(true)
    try {
      const url = editingCategory
        ? `/api/position-categories?id=${editingCategory.id}`
        : "/api/position-categories"

      const response = await fetch(url, {
        method: editingCategory ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCategory),
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
        showMessage(editingCategory ? "Position category updated" : "Position category created")
        resetCategoryForm()
      } else {
        showMessage(data.error || "Failed to save", "error")
      }
    } catch (error) {
      console.error("Error saving category:", error)
      showMessage("Failed to save position category", "error")
    } finally {
      setSavingCategory(false)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this position category?")) return

    try {
      const response = await fetch(`/api/position-categories?id=${categoryId}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (data.success) {
        await fetchData()
        showMessage("Position category deleted")
      } else {
        showMessage(data.error || "Failed to delete", "error")
      }
    } catch (error) {
      console.error("Error deleting category:", error)
      showMessage("Failed to delete position category", "error")
    }
  }

  // Staffing Requirement handlers
  const resetRequirementForm = () => {
    setNewRequirement({ positionCategoryId: "", shiftType: "DAY", minRequired: 1, idealCount: "" })
    setShowRequirementForm(false)
  }

  const handleSaveRequirement = async () => {
    if (!newRequirement.positionCategoryId) {
      showMessage("Please select a position category", "error")
      return
    }

    setSavingRequirement(true)
    try {
      const response = await fetch("/api/staffing-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRequirement,
          idealCount: newRequirement.idealCount ? parseInt(newRequirement.idealCount) : null,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
        showMessage("Staffing requirement saved")
        resetRequirementForm()
      } else {
        showMessage(data.error || "Failed to save", "error")
      }
    } catch (error) {
      console.error("Error saving requirement:", error)
      showMessage("Failed to save staffing requirement", "error")
    } finally {
      setSavingRequirement(false)
    }
  }

  // Certification handlers
  const resetCertForm = () => {
    setNewCert({ name: "", code: "", description: "", isRequired: false, validityDays: "" })
    setEditingCert(null)
    setShowCertForm(false)
  }

  const startEditCert = (cert: Certification) => {
    setEditingCert(cert)
    setNewCert({
      name: cert.name,
      code: cert.code,
      description: cert.description || "",
      isRequired: cert.isRequired,
      validityDays: cert.validityDays?.toString() || "",
    })
    setShowCertForm(true)
  }

  const handleSaveCert = async () => {
    if (!newCert.name.trim() || !newCert.code.trim()) {
      showMessage("Name and code are required", "error")
      return
    }

    setSavingCert(true)
    try {
      const url = editingCert
        ? `/api/certifications?id=${editingCert.id}`
        : "/api/certifications"

      const response = await fetch(url, {
        method: editingCert ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newCert,
          validityDays: newCert.validityDays ? parseInt(newCert.validityDays) : null,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchData()
        showMessage(editingCert ? "Certification updated" : "Certification created")
        resetCertForm()
      } else {
        showMessage(data.error || "Failed to save", "error")
      }
    } catch (error) {
      console.error("Error saving certification:", error)
      showMessage("Failed to save certification", "error")
    } finally {
      setSavingCert(false)
    }
  }

  const handleDeleteCert = async (certId: string) => {
    if (!confirm("Are you sure you want to delete this certification?")) return

    try {
      const response = await fetch(`/api/certifications?id=${certId}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (data.success) {
        await fetchData()
        showMessage("Certification deleted")
      } else {
        showMessage(data.error || "Failed to delete", "error")
      }
    } catch (error) {
      console.error("Error deleting certification:", error)
      showMessage("Failed to delete certification", "error")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Staffing Management</h1>
        <p className="text-muted-foreground">
          Configure position categories, staffing requirements, and certifications
        </p>
      </div>

      {message && (
        <Alert variant={messageType === "success" ? "success" : "destructive"}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Today's Staffing Status */}
      {staffingStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Today&apos;s Staffing Status
            </CardTitle>
            <CardDescription>Current staffing levels vs requirements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {staffingStatus.map((status, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    status.isMet ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{status.positionCategoryName}</span>
                    <Badge variant={status.shiftType === "DAY" ? "default" : "secondary"}>
                      {status.shiftType === "DAY" ? <Sun className="h-3 w-3 mr-1" /> : <Moon className="h-3 w-3 mr-1" />}
                      {status.shiftType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {status.isMet ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={status.isMet ? "text-green-700" : "text-red-700"}>
                      {status.currentCount} / {status.minRequired} required
                    </span>
                  </div>
                  {status.workers.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {status.workers.map(w => w.name).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Position Categories */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Position Categories
                </CardTitle>
                <CardDescription>Define worker position types</CardDescription>
              </div>
              {canEdit && !showCategoryForm && (
                <Button size="sm" onClick={() => setShowCategoryForm(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Category
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showCategoryForm && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">
                    {editingCategory ? "Edit Category" : "New Category"}
                  </h4>
                  <Button variant="ghost" size="sm" onClick={resetCategoryForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        placeholder="e.g., Operator"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code</Label>
                      <Input
                        placeholder="e.g., OP"
                        value={newCategory.code}
                        onChange={(e) => setNewCategory({ ...newCategory, code: e.target.value.toUpperCase() })}
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Optional description"
                      value={newCategory.description}
                      onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isOffshore"
                      checked={newCategory.isOffshore}
                      onChange={(e) => setNewCategory({ ...newCategory, isOffshore: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="isOffshore">Offshore Position</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetCategoryForm}>Cancel</Button>
                    <Button onClick={handleSaveCategory} disabled={savingCategory}>
                      {savingCategory ? "Saving..." : editingCategory ? "Update" : "Create"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {positionCategories.map((category) => (
                <div key={category.id} className="flex items-center justify-between p-3 rounded border">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{category.name}</span>
                      <Badge variant="outline">{category.code}</Badge>
                      {category.isOffshore && <Badge variant="secondary">Offshore</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {category._count.users} workers assigned
                    </p>
                    {category.staffingRequirements.length > 0 && (
                      <div className="flex gap-2 mt-1">
                        {category.staffingRequirements.map((req) => (
                          <Badge key={req.id} variant="outline" className="text-xs">
                            {req.shiftType === "DAY" ? <Sun className="h-3 w-3 mr-1" /> : <Moon className="h-3 w-3 mr-1" />}
                            Min: {req.minRequired}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEditCategory(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && category._count.users === 0 && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {positionCategories.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No position categories defined yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Staffing Requirements */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Staffing Requirements
                </CardTitle>
                <CardDescription>Set minimum workers per position per shift</CardDescription>
              </div>
              {canEdit && !showRequirementForm && positionCategories.length > 0 && (
                <Button size="sm" onClick={() => setShowRequirementForm(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Requirement
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showRequirementForm && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">New Staffing Requirement</h4>
                  <Button variant="ghost" size="sm" onClick={resetRequirementForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Position Category</Label>
                    <Select
                      value={newRequirement.positionCategoryId}
                      onChange={(e) => setNewRequirement({ ...newRequirement, positionCategoryId: e.target.value })}
                    >
                      <option value="">Select a position...</option>
                      {positionCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Shift Type</Label>
                      <Select
                        value={newRequirement.shiftType}
                        onChange={(e) => setNewRequirement({ ...newRequirement, shiftType: e.target.value })}
                      >
                        <option value="DAY">Day</option>
                        <option value="NIGHT">Night</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Min Required</Label>
                      <Input
                        type="number"
                        min={0}
                        value={newRequirement.minRequired}
                        onChange={(e) => setNewRequirement({ ...newRequirement, minRequired: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ideal Count</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Optional"
                        value={newRequirement.idealCount}
                        onChange={(e) => setNewRequirement({ ...newRequirement, idealCount: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetRequirementForm}>Cancel</Button>
                    <Button onClick={handleSaveRequirement} disabled={savingRequirement}>
                      {savingRequirement ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {positionCategories.flatMap((cat) =>
                cat.staffingRequirements.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded border">
                    <div className="flex items-center gap-3">
                      <Badge variant={req.shiftType === "DAY" ? "default" : "secondary"}>
                        {req.shiftType === "DAY" ? <Sun className="h-3 w-3 mr-1" /> : <Moon className="h-3 w-3 mr-1" />}
                        {req.shiftType}
                      </Badge>
                      <div>
                        <span className="font-medium">{cat.name}</span>
                        <p className="text-sm text-muted-foreground">
                          Min: {req.minRequired} {req.idealCount && `• Ideal: ${req.idealCount}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {positionCategories.every((cat) => cat.staffingRequirements.length === 0) && (
                <p className="text-center text-muted-foreground py-4">
                  No staffing requirements defined yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Certifications */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Certifications & Training
                </CardTitle>
                <CardDescription>Define certification types for tracking worker qualifications</CardDescription>
              </div>
              {canEdit && !showCertForm && (
                <Button size="sm" onClick={() => setShowCertForm(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Certification
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showCertForm && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">
                    {editingCert ? "Edit Certification" : "New Certification"}
                  </h4>
                  <Button variant="ghost" size="sm" onClick={resetCertForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      placeholder="e.g., Control Room Emergency Support"
                      value={newCert.name}
                      onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input
                      placeholder="e.g., CRES"
                      value={newCert.code}
                      onChange={(e) => setNewCert({ ...newCert, code: e.target.value.toUpperCase() })}
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Optional description"
                      value={newCert.description}
                      onChange={(e) => setNewCert({ ...newCert, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Validity Period (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Leave blank for no expiry"
                      value={newCert.validityDays}
                      onChange={(e) => setNewCert({ ...newCert, validityDays: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 md:col-span-2">
                    <input
                      type="checkbox"
                      id="isRequired"
                      checked={newCert.isRequired}
                      onChange={(e) => setNewCert({ ...newCert, isRequired: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="isRequired">Required certification for certain positions</Label>
                  </div>
                  <div className="flex justify-end gap-2 md:col-span-2">
                    <Button variant="outline" onClick={resetCertForm}>Cancel</Button>
                    <Button onClick={handleSaveCert} disabled={savingCert}>
                      {savingCert ? "Saving..." : editingCert ? "Update" : "Create"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {certifications.map((cert) => (
                <div key={cert.id} className="flex items-center justify-between p-3 rounded border">
                  <div>
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{cert.name}</span>
                      <Badge variant="outline">{cert.code}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {cert._count.userCertifications} certified
                      {cert.validityDays && ` • Valid ${cert.validityDays} days`}
                    </p>
                    {cert.isRequired && (
                      <Badge variant="destructive" className="mt-1 text-xs">Required</Badge>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEditCert(cert)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCert(cert.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {certifications.length === 0 && (
                <p className="text-center text-muted-foreground py-4 md:col-span-2 lg:col-span-3">
                  No certifications defined yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
