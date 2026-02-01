"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Zap, ArrowLeft, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { SUBSCRIPTION_TIERS, SubscriptionTierKey } from "@/lib/subscription"

interface SubscriptionInfo {
  tier: SubscriptionTierKey
  tierName: string
  workerLimit: number
  currentWorkerCount: number
  isTrialExpired: boolean
  trialDaysRemaining: number | null
}

export default function PricingPage() {
  const router = useRouter()
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSubscription() {
      try {
        const response = await fetch("/api/subscription")
        if (response.ok) {
          const data = await response.json()
          setSubscription(data)
        }
      } catch (error) {
        console.error("Failed to fetch subscription:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchSubscription()
  }, [])

  async function handleUpgrade(tier: SubscriptionTierKey) {
    setUpgrading(tier)
    try {
      const response = await fetch("/api/subscription/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.checkoutUrl) {
          // Redirect to Stripe checkout
          window.location.href = data.checkoutUrl
        } else {
          // Refresh subscription info
          const subResponse = await fetch("/api/subscription")
          if (subResponse.ok) {
            setSubscription(await subResponse.json())
          }
        }
      } else {
        const error = await response.json()
        alert(error.message || "Failed to process upgrade. Please try again.")
      }
    } catch (error) {
      console.error("Upgrade error:", error)
      alert("Failed to process upgrade. Please try again.")
    } finally {
      setUpgrading(null)
    }
  }

  const tiers: { key: SubscriptionTierKey; popular?: boolean }[] = [
    { key: "STARTER" },
    { key: "GROWTH", popular: true },
    { key: "PRO" },
    { key: "BUSINESS" },
  ]

  const currentTierIndex = subscription
    ? ["TRIAL", "STARTER", "GROWTH", "PRO", "BUSINESS"].indexOf(subscription.tier)
    : -1

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Back button */}
        <Button
          variant="ghost"
          className="mb-8"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Scale your workforce management with the plan that fits your team.
            All plans include our core scheduling features.
          </p>
          {subscription && (
            <div className="mt-4">
              <Badge variant="outline" className="text-sm">
                Current plan: {subscription.tierName}
                {subscription.tier === "TRIAL" && subscription.trialDaysRemaining !== null && (
                  <span className="ml-1">
                    ({subscription.trialDaysRemaining} days remaining)
                  </span>
                )}
              </Badge>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          /* Pricing Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map(({ key, popular }) => {
              const tier = SUBSCRIPTION_TIERS[key]
              const tierIndex = ["TRIAL", "STARTER", "GROWTH", "PRO", "BUSINESS"].indexOf(key)
              const isCurrentPlan = subscription?.tier === key
              const isDowngrade = tierIndex < currentTierIndex
              const isUpgrade = tierIndex > currentTierIndex

              return (
                <Card
                  key={key}
                  className={cn(
                    "relative flex flex-col",
                    popular && "border-primary shadow-lg scale-105",
                    isCurrentPlan && "ring-2 ring-primary"
                  )}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <Badge variant="secondary">Current Plan</Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{tier.name}</CardTitle>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">${tier.price}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {tier.workerLimit === 999999
                        ? "Unlimited workers"
                        : `Up to ${tier.workerLimit} workers`}
                    </p>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 flex-1">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6">
                      {isCurrentPlan ? (
                        <Button className="w-full" disabled>
                          Current Plan
                        </Button>
                      ) : isDowngrade ? (
                        <Button className="w-full" variant="outline" disabled>
                          Downgrade
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          variant={popular ? "default" : "outline"}
                          onClick={() => handleUpgrade(key)}
                          disabled={upgrading !== null}
                        >
                          {upgrading === key ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4 mr-2" />
                              {isUpgrade ? "Upgrade" : "Get Started"}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* FAQ or additional info */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold mb-4">Questions?</h2>
          <p className="text-muted-foreground mb-4">
            Need help choosing the right plan or have questions about features?
          </p>
          <Button variant="outline" onClick={() => router.push("/contact")}>
            Contact Us
          </Button>
        </div>
      </div>
    </div>
  )
}
