"use client"

import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Mail } from "lucide-react"

const CATEGORY_OPTIONS = [
  { value: "", label: "Select a category" },
  { value: "Billing", label: "Billing" },
  { value: "Scheduling", label: "Scheduling" },
  { value: "Time Off", label: "Time Off" },
  { value: "Access & Login", label: "Access & Login" },
  { value: "Bug Report", label: "Bug Report" },
  { value: "Other", label: "Other" },
]

export default function SupportPage() {
  const [formData, setFormData] = useState({
    category: "",
    subject: "",
    message: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null)

  const handleSubmit = async () => {
    if (!formData.subject || !formData.message) {
      setFeedback({ type: "error", message: "Subject and message are required." })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send support request")
      }
      setFormData({ category: "", subject: "", message: "" })
      setFeedback({ type: "success", message: "Support request sent. We will reply shortly." })
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to send support request",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Contact the ShiftSync support team."
      />

      {feedback ? (
        <Alert variant={feedback.type === "error" ? "destructive" : "success"}>
          <AlertTitle>{feedback.type === "error" ? "Support request failed" : "Request sent"}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Support Request
          </CardTitle>
          <CardDescription>Describe the issue or request in detail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
              options={CATEGORY_OPTIONS}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Short summary of the issue"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              rows={6}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={formData.message}
              onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="Include any relevant details, screenshots, or steps to reproduce."
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Request"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
