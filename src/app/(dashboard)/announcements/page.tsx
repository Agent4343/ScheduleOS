"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Megaphone,
  Plus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Pin,
  Trash2,
  Pencil,
} from "lucide-react"

interface Announcement {
  id: string
  title: string
  content: string
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  pinned: boolean
  expiresAt: string | null
  createdAt: string
  author: { id: string; name: string | null; email: string; role: string }
}

const PRIORITY_CONFIG = {
  LOW: { label: "Low", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  NORMAL: { label: "Normal", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  URGENT: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
}

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [formTitle, setFormTitle] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formPriority, setFormPriority] = useState("NORMAL")
  const [formPinned, setFormPinned] = useState(false)
  const [formExpires, setFormExpires] = useState("")

  const userRole = (session?.user as { role?: string })?.role
  const isAdmin = userRole === "ADMIN" || userRole === "SUPERVISOR"

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements")
      const data = await res.json()
      if (data.success) setAnnouncements(data.data)
    } catch {
      setError("Failed to load announcements")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

  const resetForm = () => {
    setFormTitle("")
    setFormContent("")
    setFormPriority("NORMAL")
    setFormPinned(false)
    setFormExpires("")
    setEditingId(null)
    setShowForm(false)
    setError("")
  }

  const startEdit = (a: Announcement) => {
    setEditingId(a.id)
    setFormTitle(a.title)
    setFormContent(a.content)
    setFormPriority(a.priority)
    setFormPinned(a.pinned)
    setFormExpires(a.expiresAt ? a.expiresAt.split("T")[0] : "")
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      setError("Title and content are required")
      return
    }

    setSaving(true)
    setError("")

    try {
      const url = editingId ? `/api/announcements/${editingId}` : "/api/announcements"
      const method = editingId ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          content: formContent.trim(),
          priority: formPriority,
          pinned: formPinned,
          expiresAt: formExpires || null,
        }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setSuccess(editingId ? "Announcement updated!" : "Announcement posted!")
        resetForm()
        await fetchAnnouncements()
      } else {
        setError(data.error || "Failed to save announcement")
      }
    } catch { setError("Failed to save announcement") }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" })
      if (res.ok) {
        setAnnouncements(prev => prev.filter(a => a.id !== id))
        setSuccess("Announcement deleted")
      }
    } catch { setError("Failed to delete") }
  }

  const handleTogglePin = async (a: Announcement) => {
    try {
      const res = await fetch(`/api/announcements/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !a.pinned }),
      })
      if (res.ok) await fetchAnnouncements()
    } catch { setError("Failed to update") }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Team Announcements
          </h1>
          <p className="text-muted-foreground text-sm">Important updates and messages for your team</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setShowForm(true) }} className="gap-2">
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* New / Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{editingId ? "Edit" : "New"} Announcement</CardTitle>
              <Button variant="ghost" size="sm" onClick={resetForm}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title *</Label>
              <Input id="ann-title" placeholder="e.g. Schedule change for next week" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-content">Message *</Label>
              <textarea
                id="ann-content"
                className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-y"
                placeholder="Write your announcement here..."
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
              />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ann-priority">Priority</Label>
                <select
                  id="ann-priority"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={formPriority}
                  onChange={e => setFormPriority(e.target.value)}
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-expires">Expires (optional)</Label>
                <Input id="ann-expires" type="date" value={formExpires} onChange={e => setFormExpires(e.target.value)} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formPinned} onChange={e => setFormPinned(e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm">Pin to top</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                {editingId ? "Update" : "Post Announcement"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Announcement List */}
      {announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No announcements yet</p>
            {isAdmin && <p className="text-xs mt-1">Post an announcement to keep your team informed.</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => {
            const priorityConfig = PRIORITY_CONFIG[a.priority]
            return (
              <Card key={a.id} className={a.priority === "URGENT" ? "border-red-300 dark:border-red-800" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                        <CardTitle className="text-base">{a.title}</CardTitle>
                        <Badge className={`text-xs ${priorityConfig.color}`}>{priorityConfig.label}</Badge>
                      </div>
                      <CardDescription>
                        {a.author.name || a.author.email} &middot; {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        {a.expiresAt && (
                          <> &middot; Expires {new Date(a.expiresAt).toLocaleDateString()}</>
                        )}
                      </CardDescription>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleTogglePin(a)} title={a.pinned ? "Unpin" : "Pin"}>
                          <Pin className={`h-4 w-4 ${a.pinned ? "text-primary" : ""}`} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{a.content}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
