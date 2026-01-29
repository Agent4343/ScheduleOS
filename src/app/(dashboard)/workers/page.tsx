"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import { Avatar } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/toast"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
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
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle,
  Zap,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  crew: {
    id: string
    name: string
    color: string
  } | null
  customRoleId: string | null
  customRole: {
    id: string
    name: string
    color: string
  } | null
  // Training certifications
  isControlRoomTrained?: boolean
  isOilOperatorTrained?: boolean
  isUtilityOperatorTrained?: boolean
  isGasOperatorTrained?: boolean
}

interface Crew {
  id: string
  name: string
  color: string
}

interface CustomRole {
  id: string
  name: string
  color: string
  baseRole: "ADMIN" | "SUPERVISOR" | "WORKER"
}

interface CertificationType {
  id: string
  name: string
  description: string | null
  color: string
  isRequired: boolean
}

interface SubscriptionInfo {
  tier: string
  tierName: string
  workerLimit: number
  workerCount: number
  workersRemaining: number
  canAddWorkers: boolean
  isAtLimit: boolean
  isTrialExpired: boolean
}

const STATUS_BADGES: Record<UserStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  ACTIVE: { variant: "default", label: "Active" },
  INACTIVE: { variant: "secondary", label: "Inactive" },
  ON_LEAVE: { variant: "outline", label: "On Leave" },
  TERMINATED: { variant: "destructive", label: "Terminated" },
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  SUPERVISOR: "Supervisor",
  WORKER: "Worker",
}

export default function WorkersPage() {
  const { addToast } = useToast()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [users, setUsers] = useState<User[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [certificationTypes, setCertificationTypes] = useState<CertificationType[]>([])
  const [selectedCertifications, setSelectedCertifications] = useState<Map<string, { expiresAt: string | null; earnedAt: string }>>(new Map())
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [crewFilter, setCrewFilter] = useState<string>("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "WORKER" as UserRole,
    position: "",
    phone: "",
    crewId: "",
    customRoleId: "",
    hireDate: "",
    password: "",
  })
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    role: "WORKER" as UserRole,
    position: "",
    phone: "",
    crewId: "",
    customRoleId: "",
    hireDate: "",
    status: "ACTIVE" as UserStatus,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [usersRes, crewsRes, rolesRes, certsRes, subRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/crews"),
          fetch("/api/roles"),
          fetch("/api/certifications"),
          fetch("/api/subscription"),
        ])

        const usersData = await usersRes.json()
        const crewsData = await crewsRes.json()
        const rolesData = await rolesRes.json()
        const certsData = await certsRes.json()
        const subData = await subRes.json()

        if (usersData.success) setUsers(usersData.data)
        if (crewsData.success) setCrews(crewsData.data)
        if (rolesData.success) setCustomRoles(rolesData.data)
        if (certsData.success) setCertificationTypes(certsData.data)
        if (subData.success) setSubscription(subData.data)
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

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchQuery ||
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = !statusFilter || user.status === statusFilter
    const matchesCrew = !crewFilter || user.crew?.id === crewFilter

    return matchesSearch && matchesStatus && matchesCrew
  })

  async function openEditModal(user: User) {
    setEditingUser(user)
    setEditFormData({
      name: user.name || "",
      email: user.email,
      role: user.role,
      position: user.position || "",
      phone: user.phone || "",
      crewId: user.crew?.id || "",
      customRoleId: user.customRoleId || "",
      hireDate: user.hireDate ? user.hireDate.split("T")[0] : "",
      status: user.status,
    })
    // Fetch user's certifications with expiry dates
    try {
      const res = await fetch(`/api/users/${user.id}/certifications`)
      const data = await res.json()
      if (data.success) {
        const certMap = new Map<string, { expiresAt: string | null; earnedAt: string }>()
        for (const cert of data.data) {
          certMap.set(cert.certificationTypeId, {
            expiresAt: cert.expiresAt ? cert.expiresAt.split("T")[0] : null,
            earnedAt: cert.earnedAt ? cert.earnedAt.split("T")[0] : new Date().toISOString().split("T")[0],
          })
        }
        setSelectedCertifications(certMap)
      } else {
        setSelectedCertifications(new Map())
      }
    } catch {
      setSelectedCertifications(new Map())
    }
    setIsEditModalOpen(true)
    setOpenMenuId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          hireDate: formData.hireDate || undefined,
          crewId: formData.crewId || undefined,
          customRoleId: formData.customRoleId || undefined,
          password: formData.password || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setUsers((prev) => [...prev, data.data])
        // Update subscription count
        if (subscription) {
          setSubscription({
            ...subscription,
            workerCount: subscription.workerCount + 1,
            workersRemaining: subscription.workersRemaining - 1,
            canAddWorkers: subscription.workersRemaining - 1 > 0,
            isAtLimit: subscription.workersRemaining - 1 <= 0,
          })
        }
        setIsModalOpen(false)
        setFormData({
          name: "",
          email: "",
          role: "WORKER",
          position: "",
          phone: "",
          crewId: "",
          customRoleId: "",
          hireDate: "",
          password: "",
        })
        addToast({ type: "success", message: "Worker added successfully" })
      } else if (data.code === "WORKER_LIMIT_REACHED") {
        setIsModalOpen(false)
        addToast({
          type: "error",
          message: data.message || "Worker limit reached. Please upgrade your plan.",
        })
      } else if (data.code === "TRIAL_EXPIRED") {
        setIsModalOpen(false)
        addToast({
          type: "error",
          message: "Your trial has expired. Please upgrade to continue.",
        })
      } else {
        addToast({ type: "error", message: data.error || "Failed to create worker" })
      }
    } catch (error) {
      console.error("Failed to create worker:", error)
      addToast({ type: "error", message: "Failed to create worker" })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return
    setSubmitting(true)

    try {
      // Update user info
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editFormData.name,
          email: editFormData.email,
          role: editFormData.role,
          position: editFormData.position || null,
          phone: editFormData.phone || null,
          crewId: editFormData.crewId || null,
          customRoleId: editFormData.customRoleId || null,
          hireDate: editFormData.hireDate || null,
          status: editFormData.status,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Update certifications if any certification types exist
        if (certificationTypes.length > 0) {
          const certifications = Array.from(selectedCertifications.entries()).map(([certId, certData]) => ({
            certificationId: certId,
            expiresAt: certData.expiresAt,
            earnedAt: certData.earnedAt,
          }))
          await fetch(`/api/users/${editingUser.id}/certifications`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ certifications }),
          })
        }

        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? data.data : u))
        )
        setIsEditModalOpen(false)
        setEditingUser(null)
        setSelectedCertifications(new Map())
        addToast({ type: "success", message: "Worker updated successfully" })
      } else {
        // Show detailed validation errors if available
        let errorMessage = data.error || "Failed to update worker"
        if (data.details && Array.isArray(data.details) && data.details.length > 0) {
          const fieldErrors = data.details.map((d: { field: string; message: string }) => `${d.field}: ${d.message}`).join(", ")
          errorMessage = `${errorMessage} (${fieldErrors})`
        }
        addToast({ type: "error", message: errorMessage })
      }
    } catch (error) {
      console.error("Failed to update worker:", error)
      addToast({ type: "error", message: "Failed to update worker" })
    } finally {
      setSubmitting(false)
    }
  }

  function handleDelete(userId: string) {
    setOpenMenuId(null)
    confirm({
      title: "Delete Worker",
      description: "Are you sure you want to delete this worker? This action cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/users/${userId}`, {
            method: "DELETE",
          })

          const data = await response.json()

          if (data.success) {
            setUsers((prev) => prev.filter((u) => u.id !== userId))
            addToast({ type: "success", message: "Worker deleted successfully" })
          } else {
            addToast({ type: "error", message: data.error || "Failed to delete worker" })
          }
        } catch (error) {
          console.error("Failed to delete worker:", error)
          addToast({ type: "error", message: "Failed to delete worker" })
        }
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Subscription Warning Banner */}
      {subscription && (subscription.isAtLimit || subscription.isTrialExpired) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {subscription.isTrialExpired
                ? "Your free trial has expired. Upgrade to continue adding workers."
                : `You've reached your ${subscription.tierName} plan limit of ${subscription.workerLimit} workers.`}
            </span>
            <Button size="sm" variant="outline" onClick={() => window.open("/pricing", "_blank")}>
              <Zap className="h-4 w-4 mr-1" />
              Upgrade Now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Approaching Limit Warning */}
      {subscription && !subscription.isAtLimit && subscription.workersRemaining <= 3 && subscription.workersRemaining > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have {subscription.workersRemaining} worker slot{subscription.workersRemaining !== 1 ? "s" : ""} remaining on your {subscription.tierName} plan.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workers</h1>
          <p className="text-muted-foreground">
            Manage your workforce ({users.length} total)
            {subscription && subscription.workerLimit !== 999999 && (
              <span className="ml-1">
                · {subscription.workersRemaining} slot{subscription.workersRemaining !== 1 ? "s" : ""} available
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          disabled={subscription?.isAtLimit || subscription?.isTrialExpired}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Worker
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
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
              { value: "", label: "All Crews" },
              ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
            ]}
            className="w-32"
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Crew</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar alt={user.name || user.email} size="sm" />
                        <div>
                          <p className="font-medium">{user.name || "Unnamed"}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.crew ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: user.crew.color }}
                          />
                          {user.crew.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>{user.position || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{ROLE_LABELS[user.role]}</span>
                        {user.customRole && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full inline-block w-fit"
                            style={{ backgroundColor: user.customRole.color, color: "#fff" }}
                          >
                            {user.customRole.name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGES[user.status].variant}>
                        {STATUS_BADGES[user.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="relative" ref={openMenuId === user.id ? menuRef : null}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                        {openMenuId === user.id && (
                          <div className="absolute right-0 top-full mt-1 w-36 bg-background border rounded-md shadow-lg z-10">
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                              onClick={() => openEditModal(user)}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 text-destructive"
                              onClick={() => handleDelete(user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Worker Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Worker"
        description="Add a new worker to your organization"
      >
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
                autoComplete="off"
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
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="customRoleId">Custom Role</Label>
              <Select
                value={formData.customRoleId}
                onChange={(e) => setFormData((prev) => ({ ...prev, customRoleId: e.target.value }))}
                options={[
                  { value: "", label: "None" },
                  ...customRoles.map((role) => ({ value: role.id, label: role.name })),
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="crewId">Crew</Label>
              <Select
                value={formData.crewId}
                onChange={(e) => setFormData((prev) => ({ ...prev, crewId: e.target.value }))}
                options={[
                  { value: "", label: "No Crew" },
                  ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
                placeholder="e.g., Operator, Supervisor"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                autoComplete="off"
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

          <div className="space-y-2">
            <Label htmlFor="password">Password (Optional)</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Leave blank for invite"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Worker"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Worker Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingUser(null)
          setSelectedCertifications(new Map())
        }}
        title="Edit Worker"
        description="Update worker information"
      >
        <form onSubmit={handleUpdate} className="space-y-4" autoComplete="off">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, email: e.target.value }))}
                required
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role">System Role</Label>
              <Select
                value={editFormData.role}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                options={[
                  { value: "WORKER", label: "Worker" },
                  { value: "SUPERVISOR", label: "Supervisor" },
                  { value: "ADMIN", label: "Administrator" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-customRoleId">Custom Role</Label>
              <Select
                value={editFormData.customRoleId}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, customRoleId: e.target.value }))}
                options={[
                  { value: "", label: "None" },
                  ...customRoles.map((role) => ({ value: role.id, label: role.name })),
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editFormData.status}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, status: e.target.value as UserStatus }))}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "ON_LEAVE", label: "On Leave" },
                  { value: "TERMINATED", label: "Terminated" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-crewId">Crew</Label>
              <Select
                value={editFormData.crewId}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, crewId: e.target.value }))}
                options={[
                  { value: "", label: "No Crew" },
                  ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-position">Position</Label>
              <Input
                id="edit-position"
                value={editFormData.position}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, position: e.target.value }))}
                placeholder="e.g., Operator, Supervisor"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editFormData.phone}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, phone: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hireDate">Hire Date</Label>
              <Input
                id="edit-hireDate"
                type="date"
                value={editFormData.hireDate}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, hireDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Training Certifications */}
          {certificationTypes.length > 0 && (
            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium">Training & Certifications</Label>
              <p className="text-xs text-muted-foreground">Select certifications and set expiry dates (optional)</p>
              <div className="space-y-3">
                {certificationTypes.map((cert) => {
                  const isSelected = selectedCertifications.has(cert.id)
                  const certData = selectedCertifications.get(cert.id)
                  return (
                    <div key={cert.id} className="p-3 border rounded-lg space-y-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newMap = new Map(selectedCertifications)
                            if (e.target.checked) {
                              newMap.set(cert.id, {
                                expiresAt: null,
                                earnedAt: new Date().toISOString().split("T")[0],
                              })
                            } else {
                              newMap.delete(cert.id)
                            }
                            setSelectedCertifications(newMap)
                          }}
                          className="rounded border-gray-300"
                        />
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cert.color }}
                        />
                        <span className="font-medium">{cert.name}</span>
                        {cert.isRequired && <span className="text-xs text-muted-foreground">(Required)</span>}
                      </label>
                      {isSelected && (
                        <div className="ml-6 flex gap-4 text-xs">
                          <div className="space-y-1">
                            <label className="text-muted-foreground">Earned</label>
                            <Input
                              type="date"
                              className="h-8 w-36 text-xs"
                              value={certData?.earnedAt || ""}
                              onChange={(e) => {
                                const newMap = new Map(selectedCertifications)
                                newMap.set(cert.id, {
                                  ...certData!,
                                  earnedAt: e.target.value,
                                })
                                setSelectedCertifications(newMap)
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-muted-foreground">Expires</label>
                            <Input
                              type="date"
                              className="h-8 w-36 text-xs"
                              value={certData?.expiresAt || ""}
                              onChange={(e) => {
                                const newMap = new Map(selectedCertifications)
                                newMap.set(cert.id, {
                                  ...certData!,
                                  expiresAt: e.target.value || null,
                                })
                                setSelectedCertifications(newMap)
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => {
              setIsEditModalOpen(false)
              setEditingUser(null)
              setSelectedCertifications(new Map())
            }}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog />
    </div>
  )
}
