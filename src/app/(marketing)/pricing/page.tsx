import { Metadata } from "next"
import { PricingCards } from "./pricing-cards"

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose the right plan for your offshore scheduling needs. Start with a 14-day free trial.",
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required to explore.
            Upgrade when you&apos;re ready.
          </p>
        </div>

        <PricingCards />

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            All plans include SSL encryption, daily backups, and 99.9% uptime SLA.
            <br />
            Need a custom plan?{" "}
            <a href="/contact" className="text-primary underline hover:no-underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
