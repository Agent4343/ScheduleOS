"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, Loader2, ArrowLeft, CheckCircle2, XCircle } from "lucide-react"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)

  // If no token, show error state
  if (!token) {
    return (
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900">
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardTitle className="text-xl">Invalid Reset Link</CardTitle>
          <CardDescription className="mt-2">
            This password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Link href="/forgot-password" className="w-full">
              <Button className="w-full">Request a New Link</Button>
            </Link>
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError("Password must contain at least one uppercase letter, one lowercase letter, and one number")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to reset password")
        return
      }

      setIsSuccess(true)
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-xl">Password Reset Successful</CardTitle>
          <CardDescription className="mt-2">
            Your password has been reset successfully. You can now log in with your new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.push("/login")}>
            Continue to Login
          </Button>
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
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and number.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset Password
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

function ResetPasswordSkeleton() {
  return (
    <Card className="shadow-xl">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-2 text-primary">
            <Calendar className="h-8 w-8" />
            <span className="text-2xl font-bold">ShiftSync</span>
          </div>
        </div>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-10 bg-muted rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-10 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-10 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
