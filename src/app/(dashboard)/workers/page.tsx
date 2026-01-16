"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import { Avatar } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Users,
  Plus,
  Search,
  Mail,
  Filter,
  Pencil,
  Trash2,
  Award,
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
} from "lucide-react"
import { UserRole, UserStatus } from "@/types"

interface User {
  id: string
  email: string
  name: string | null
  role: UserRole
  position: string | null
  phone: string | null
  status: UserStatus
  hireDate: string | null
  rotationGroup: string | null
  primaryPosition: string | null
  isCCRQualified: boolean
  isPSCapable: boolean
  isPLCapable: boolean
  crew: {
    id: string
    name: string
    color: string
    code: string | null
  } | null
}

interface Crew {
  id: string
  name: string
  color: string
  code: string | null
}

const STATUS_BADGES: Record<UserStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  ACTIVE: { variant: "default", label: "Active" },
  INACTIVE: { variant: "secondary", label: "Inactive" },
  ON_LEAVE: { variant: "outline", label: "On Leave" },
  TERMINATED: { variant: "destructive", label: "Terminated" },
}

const PRIMARY_POSITION_OPTIONS = [
  { value: "", label: "Select Position" },
  { value: "OIM", label: "OIM (Offshore Installation Manager)" },
  { value: "Production Supervisor", label: "Production Supervisor" },
  { value: "Production Lead", label: "Production Lead" },
  { value: "OCR Operator", label: "OCR Operator (Control Room)" },
  { value: "Ops Tech", label: "Ops Tech (Operations Technician)" },
]

const ROTATION_GROUP_OPTIONS = [
  { value: "", label: "Select Rotation Group" },
  { value: "151", label: "151 - Primary 21/21" },
  { value: "351", label: "351 - Alternating 21/21 (Group 1)" },
  { value: "352", label: "352 - Alternating 21/21 (Group 2)" },
  { value: "451", label: "451 - Alternating 21/21 (Group 3)" },
  { value: "OCR", label: "OCR - Control Room 14/14" },
]

interface FormData {
  name: string
  email: string
  role: UserRole
  position: string
  primaryPosition: string
  rotationGroup: string
  phone: string
  crewId: string
  hireDate: string
  password: string
  status: UserStatus
  isCCRQualified: boolean
  isPSCapable: boolean
  isPLCapable: boolean
}

const initialFormData: FormData = {
  name: "",
  email: "",
  role: "WORKER",
  position: "",
  primaryPosition: "",
  rotationGroup: "",
  phone: "",
  crewId: "",
  hireDate: "",
  password: "",
  status: "ACTIVE",
  isCCRQualified: false,
  isPSCapable: false,
  isPLCapable: false,
}

export default function WorkersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [crewFilter, setCrewFilter] = useState<string>("")
  const [positionFilter, setPositionFilter] = useState<string>("")

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    created: number
    updated: number
    errors: { row: number; email: string; error: string }[]
  } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [usersRes, crewsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/crews"),
      ])

      const usersData = await usersRes.json()
      const crewsData = await crewsRes.json()

      if (usersData.success) setUsers(usersData.data)
      if (crewsData.success) setCrews(crewsData.data)
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  function openUploadModal() {
    setUploadFile(null)
    setUploadResult(null)
    setUploadModalOpen(true)
  }

  async function downloadTemplate() {
    try {
      const response = await fetch("/api/users/upload")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "worker_template.xlsx"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to download template:", error)
    }
  }

  async function handleUpload() {
    if (!uploadFile) return

    setUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append("file", uploadFile)

      const response = await fetch("/api/users/upload", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setUploadResult(result.data)
        // Refresh users list
        fetchData()
      } else {
        setUploadResult({
          created: 0,
          updated: 0,
          errors: [{ row: 0, email: "", error: result.error || "Upload failed" }],
        })
      }
    } catch {
      setUploadResult({
        created: 0,
        updated: 0,
        errors: [{ row: 0, email: "", error: "Failed to upload file" }],
      })
    } finally {
      setUploading(false)
    }
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchQuery ||
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = !statusFilter || user.status === statusFilter
    const matchesCrew = !crewFilter || user.crew?.id === crewFilter
    const matchesPosition = !positionFilter || user.primaryPosition === positionFilter

    return matchesSearch && matchesStatus && matchesCrew && matchesPosition
  })

  function openAddModal() {
    setIsEditing(false)
    setEditingUserId(null)
    setFormData(initialFormData)
    setError(null)
    setIsModalOpen(true)
  }

  function openEditModal(user: User) {
    setIsEditing(true)
    setEditingUserId(user.id)
    setFormData({
      name: user.name || "",
      email: user.email,
      role: user.role,
      position: user.position || "",
      primaryPosition: user.primaryPosition || "",
      rotationGroup: user.rotationGroup || "",
      phone: user.phone || "",
      crewId: user.crew?.id || "",
      hireDate: user.hireDate ? user.hireDate.split("T")[0] : "",
      password: "",
      status: user.status,
      isCCRQualified: user.isCCRQualified,
      isPSCapable: user.isPSCapable,
      isPLCapable: user.isPLCapable,
    })
    setError(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setIsEditing(false)
    setEditingUserId(null)
    setFormData(initialFormData)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const url = isEditing ? `/api/users/${editingUserId}` : "/api/users"
      const method = isEditing ? "PATCH" : "POST"

      const payload: Record<string, unknown> = {
        name: formData.name,
        role: formData.role,
        position: formData.position || null,
        primaryPosition: formData.primaryPosition || null,
        rotationGroup: formData.rotationGroup || null,
        phone: formData.phone || null,
        crewId: formData.crewId || null,
        hireDate: formData.hireDate || null,
        status: formData.status,
        isCCRQualified: formData.isCCRQualified,
        isPSCapable: formData.isPSCapable,
        isPLCapable: formData.isPLCapable,
      }

      // Only include email and password for new users
      if (!isEditing) {
        payload.email = formData.email
        if (formData.password) {
          payload.password = formData.password
        }
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        await fetchData() // Refresh the list
        closeModal()
      } else {
        setError(data.error || `Failed to ${isEditing ? "update" : "create"} worker`)
      }
    } catch (err) {
      console.error("Failed to save worker:", err)
      setError("An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  function openDeleteModal(user: User) {
    setUserToDelete(user)
    setDeleteModalOpen(true)
  }

  async function handleDelete() {
    if (!userToDelete) return

    try {
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id))
        setDeleteModalOpen(false)
        setUserToDelete(null)
      } else {
        const data = await response.json()
        alert(data.error || "Failed to delete worker")
      }
    } catch (err) {
      console.error("Failed to delete worker:", err)
      alert("Failed to delete worker")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workers</h1>
          <p className="text-muted-foreground">
            Manage your workforce ({users.length} total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openUploadModal}>
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
          <Button onClick={openAddModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Worker
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: "All Status" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "ON_LEAVE", label: "On Leave" },
            ]}
            className="w-32"
          />
          <Select
            value={crewFilter}
            onChange={(e) => setCrewFilter(e.target.value)}
            options={[
              { value: "", label: "All Rotations" },
              ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
            ]}
            className="w-40"
          />
          <Select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            options={[
              { value: "", label: "All Positions" },
              ...PRIMARY_POSITION_OPTIONS.slice(1),
            ]}
            className="w-40"
          />
        </div>
      </div>

      {/* Workers table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Workers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No workers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Rotation</TableHead>
                    <TableHead>Qualifications</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar alt={user.name || user.email} size="sm" />
                          <div>
                            <p className="font-medium">
                              {user.name || "Unnamed"}
                              {user.isCCRQualified && (
                                <span className="text-amber-500 ml-1">*</span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.primaryPosition || "-"}</p>
                          {user.position && user.position !== user.primaryPosition && (
                            <p className="text-xs text-muted-foreground">{user.position}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.crew ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: user.crew.color }}
                            />
                            <div>
                              <p>{user.crew.name}</p>
                              {user.crew.code && (
                                <p className="text-xs text-muted-foreground">
                                  Group {user.crew.code}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.isCCRQualified && (
                            <Badge variant="secondary" className="text-xs">
                              <Award className="h-3 w-3 mr-1" />
                              CCR
                            </Badge>
                          )}
                          {user.isPSCapable && (
                            <Badge variant="outline" className="text-xs">PS</Badge>
                          )}
                          {user.isPLCapable && (
                            <Badge variant="outline" className="text-xs">PL</Badge>
                          )}
                          {!user.isCCRQualified && !user.isPSCapable && !user.isPLCapable && (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGES[user.status].variant}>
                          {STATUS_BADGES[user.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(user)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteModal(user)}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Worker Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={isEditing ? "Edit Worker" : "Add Worker"}
        description={isEditing ? "Update worker information" : "Add a new worker to your organization"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                required
                disabled={isEditing}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryPosition">Primary Position</Label>
              <Select
                value={formData.primaryPosition}
                onChange={(e) => setFormData((prev) => ({ ...prev, primaryPosition: e.target.value }))}
                options={PRIMARY_POSITION_OPTIONS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rotationGroup">Rotation Group</Label>
              <Select
                value={formData.rotationGroup}
                onChange={(e) => setFormData((prev) => ({ ...prev, rotationGroup: e.target.value }))}
                options={ROTATION_GROUP_OPTIONS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="crewId">Rotation Assignment</Label>
              <Select
                value={formData.crewId}
                onChange={(e) => setFormData((prev) => ({ ...prev, crewId: e.target.value }))}
                options={[
                  { value: "", label: "No Assignment" },
                  ...crews.map((crew) => ({
                    value: crew.id,
                    label: `${crew.name}${crew.code ? ` (${crew.code})` : ""}`,
                  })),
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">System Role</Label>
              <Select
                value={formData.role}
                onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                options={[
                  { value: "WORKER", label: "Worker" },
                  { value: "SUPERVISOR", label: "Supervisor" },
                  { value: "ADMIN", label: "Administrator" },
                ]}
              />
            </div>
          </div>

          {/* Qualifications */}
          <div className="space-y-2">
            <Label>Qualifications</Label>
            <div className="flex flex-wrap gap-3 p-3 bg-muted/50 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isCCRQualified}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isCCRQualified: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">CCR Trained (Central Control Room)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isPSCapable}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isPSCapable: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">PS Capable (Can backfill Production Supervisor)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isPLCapable}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isPLCapable: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">PL Capable (Can backfill Production Lead)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hireDate">Hire Date</Label>
              <Input
                id="hireDate"
                type="date"
                value={formData.hireDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, hireDate: e.target.value }))}
              />
            </div>
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as UserStatus }))}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "ON_LEAVE", label: "On Leave" },
                  { value: "TERMINATED", label: "Terminated" },
                ]}
              />
            </div>
          )}

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="password">Password (Optional)</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Leave blank to send invite"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Add Worker"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setUserToDelete(null)
        }}
        title="Delete Worker"
        description="Are you sure you want to delete this worker?"
      >
        <div className="space-y-4">
          {userToDelete && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{userToDelete.name}</p>
              <p className="text-sm text-muted-foreground">{userToDelete.email}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. All schedule data for this worker will be deleted.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false)
                setUserToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Worker
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Import Workers from Excel"
        description="Upload an Excel file to add or update multiple workers at once"
      >
        <div className="space-y-4">
          {/* Template Download */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-sm">Download Template</p>
                  <p className="text-xs text-muted-foreground">
                    Get a pre-formatted Excel template with sample data
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />
                Template
              </Button>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload Excel File</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">
                  {uploadFile ? uploadFile.name : "Click to select file"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .xlsx and .xls files
                </p>
              </label>
            </div>
          </div>

          {/* Required Fields Info */}
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Required columns:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Full Name</li>
              <li>Email</li>
            </ul>
            <p className="font-medium mt-2 mb-1">Optional columns:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Primary Position, Rotation Group, System Role</li>
              <li>Phone, Hire Date</li>
              <li>CCR Trained, PS Capable, PL Capable (Yes/No)</li>
            </ul>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className={`p-3 rounded-lg ${uploadResult.errors.length > 0 && uploadResult.created === 0 && uploadResult.updated === 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              <p className="font-medium">
                {uploadResult.created > 0 && `${uploadResult.created} workers created. `}
                {uploadResult.updated > 0 && `${uploadResult.updated} workers updated. `}
                {uploadResult.errors.length > 0 && `${uploadResult.errors.length} errors.`}
              </p>
              {uploadResult.errors.length > 0 && (
                <div className="mt-2 text-xs max-h-32 overflow-auto">
                  {uploadResult.errors.map((err, i) => (
                    <p key={i}>
                      {err.row > 0 ? `Row ${err.row}` : ""} {err.email && `(${err.email})`}: {err.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setUploadModalOpen(false)}>
              {uploadResult ? "Close" : "Cancel"}
            </Button>
            {!uploadResult && (
              <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Workers
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
