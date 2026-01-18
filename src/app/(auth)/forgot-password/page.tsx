"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to process request")
        return
      }

      setIsSubmitted(true)
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription className="mt-2">
            If an account exists with <span className="font-medium">{email}</span>,
            you will receive a password reset link shortly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            The link will expire in 60 minutes. If you don&apos;t see the email,
            check your spam folder.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setIsSubmitted(false)
                setEmail("")
              }}
            >
              Try a different email
            </Button>
            <Link href="/login" className="w-full">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-xl">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-2 text-primary">
            <Calendar className="h-8 w-8" />
            <span className="text-2xl font-bold">ShiftSync</span>
          </div>
        </div>
        <CardTitle className="text-xl">Forgot your password?</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reset Link
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-primary inline-flex items-center"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to login
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
