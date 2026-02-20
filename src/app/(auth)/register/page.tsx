"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Calendar, Loader2, Check, CreditCard } from "lucide-react"
import { Suspense } from "react"

const PLAN_INFO: Record<string, { name: string; price: number; trial: number }> = {
  starter: { name: "Starter", price: 29, trial: 14 },
  professional: { name: "Professional", price: 49, trial: 14 },
  enterprise: { name: "Enterprise", price: 99, trial: 14 },
}

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedPlan = searchParams.get("plan") || ""
  const planInfo = PLAN_INFO[selectedPlan]

  const [step] = useState<"account" | "payment">("account")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    organizationName: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      // Step 1: Create the account
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          organizationName: formData.organizationName || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Registration failed")
        setIsLoading(false)
        return
      }

      // Step 2: If a plan was selected, redirect to Stripe Checkout
      if (planInfo && process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true") {
        const checkoutRes = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: selectedPlan,
            email: formData.email,
            organizationName: formData.organizationName,
          }),
        })

        const checkoutData = await checkoutRes.json()

        if (checkoutData.url) {
          window.location.href = checkoutData.url
          return
        }
      }

      // No Stripe or no plan — go straight to login
      router.push("/login?registered=true")
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
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
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          {planInfo
            ? `${planInfo.name} plan — ${planInfo.trial}-day free trial`
            : "Get started with ShiftSync today"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Plan badge */}
        {planInfo && (
          <div className="mb-6 rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{planInfo.name}</Badge>
                  <span className="text-sm text-muted-foreground">plan</span>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  ${planInfo.price}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  {planInfo.trial}-day free trial
                </div>
              </div>
            </div>
            <Link
              href="/pricing"
              className="mt-2 inline-block text-xs text-muted-foreground underline hover:no-underline"
            >
              Change plan
            </Link>
          </div>
        )}

        {/* Steps indicator */}
        {planInfo && (
          <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={step === "account" ? "font-semibold text-foreground" : ""}>
              1. Account
            </span>
            <span>&rarr;</span>
            <span className={step === "payment" ? "font-semibold text-foreground" : ""}>
              2. Payment
            </span>
            <span>&rarr;</span>
            <span>3. Dashboard</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Smith"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 12 characters"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={12}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationName">Organization Name</Label>
            <Input
              id="organizationName"
              name="organizationName"
              type="text"
              placeholder="Your Company Name"
              value={formData.organizationName}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading} size="lg">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {planInfo ? (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Create Account &amp; Start Free Trial
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        {!planInfo && (
          <div className="mt-4 text-center">
            <Link
              href="/pricing"
              className="text-sm text-primary hover:underline font-medium"
            >
              View plans &amp; pricing
            </Link>
          </div>
        )}

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <Card className="shadow-xl">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    }>
      <RegisterForm />
    </Suspense>
  )
}
