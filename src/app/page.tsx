import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import {
  Clock,
  Calendar,
  Users,
  BarChart3,
  Shield,
  Zap,
  Check,
  ArrowRight,
  Star,
  ChevronRight,
} from "lucide-react"

const features = [
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description:
      "Automatically generate schedules based on rotation patterns, qualifications, and availability.",
  },
  {
    icon: Users,
    title: "Crew Management",
    description:
      "Organize workers into rotation groups with automatic day/night shift alternation.",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description:
      "Track staffing levels, overtime, and coverage gaps with visual dashboards.",
  },
  {
    icon: Shield,
    title: "Qualification Tracking",
    description:
      "Monitor certifications, training requirements, and role capabilities.",
  },
  {
    icon: Zap,
    title: "Instant Updates",
    description:
      "Push schedule changes instantly with automatic notifications to affected workers.",
  },
  {
    icon: Clock,
    title: "Time-Off Management",
    description:
      "Streamlined request and approval workflow for vacations, sick leave, and more.",
  },
]

const pricing = [
  {
    name: "Free",
    price: 0,
    description: "For small teams getting started",
    features: [
      "Up to 10 workers",
      "2 rotation groups",
      "30-day schedule history",
      "Basic reporting",
      "Community support",
    ],
    cta: "Get Started",
    href: "/register",
    popular: false,
  },
  {
    name: "Pro",
    price: 29,
    description: "For growing operations",
    features: [
      "Up to 50 workers",
      "10 rotation groups",
      "1-year schedule history",
      "Advanced reporting",
      "Email notifications",
      "Priority support",
      "Export to PDF/Excel",
    ],
    cta: "Start Free Trial",
    href: "/register?plan=pro",
    popular: true,
  },
  {
    name: "Enterprise",
    price: 99,
    description: "For large-scale operations",
    features: [
      "Unlimited workers",
      "Unlimited rotation groups",
      "Unlimited history",
      "Custom reporting",
      "SMS notifications",
      "API access",
      "SSO integration",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    href: "/register?plan=enterprise",
    popular: false,
  },
]

const testimonials = [
  {
    quote:
      "ShiftSync transformed how we manage our offshore crews. What used to take hours now takes minutes.",
    author: "Sarah M.",
    role: "Operations Manager",
    company: "Atlantic Energy",
  },
  {
    quote:
      "The rotation pattern automation alone saved us countless scheduling conflicts. Highly recommended.",
    author: "James R.",
    role: "HR Director",
    company: "Pacific Drilling Co.",
  },
  {
    quote:
      "Finally, a scheduling tool that understands the complexity of offshore operations.",
    author: "Michael T.",
    role: "Platform Supervisor",
    company: "Northern Oil & Gas",
  },
]

const steps = [
  {
    step: "1",
    title: "Set Up Your Crews",
    description:
      "Define rotation groups, patterns, and assign workers to their crews.",
  },
  {
    step: "2",
    title: "Configure Positions",
    description:
      "Set staffing requirements, qualifications, and shift types for each role.",
  },
  {
    step: "3",
    title: "Generate Schedules",
    description:
      "Let ShiftSync automatically create optimized schedules based on your rules.",
  },
  {
    step: "4",
    title: "Manage & Adapt",
    description:
      "Handle time-off requests, swaps, and changes with real-time updates.",
  },
]

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">ShiftSync</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">
                Features
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
                Pricing
              </a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">
                How It Works
              </a>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center rounded-full border px-4 py-1.5 text-sm">
              <span className="text-primary font-medium">New</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span className="text-muted-foreground">Offshore operations scheduling</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Workforce Scheduling
              <span className="text-primary"> Made Simple</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              The intelligent scheduling platform built for offshore operations.
              Manage rotation patterns, track qualifications, and optimize staffing
              with powerful automation.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 w-full sm:w-auto"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-md border px-8 py-3 text-sm font-medium hover:bg-accent w-full sm:w-auto"
              >
                See How It Works
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No credit card required. 14-day free trial.
            </p>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl" />
        </div>
      </section>

      {/* Logos Section */}
      <section className="border-y py-12 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Trusted by leading offshore operations companies
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8 opacity-60">
            <div className="text-xl font-bold text-muted-foreground">Atlantic Energy</div>
            <div className="text-xl font-bold text-muted-foreground">Northern Oil</div>
            <div className="text-xl font-bold text-muted-foreground">Pacific Drilling</div>
            <div className="text-xl font-bold text-muted-foreground">Offshore Corp</div>
            <div className="text-xl font-bold text-muted-foreground">Maritime Ops</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to manage your workforce
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Powerful features designed specifically for offshore and shift-based operations.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="relative rounded-2xl border bg-card p-8 hover:shadow-lg transition-shadow"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 sm:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Get started in minutes
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Four simple steps to transform your workforce scheduling.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((item, index) => (
              <div key={item.step} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="hidden lg:block absolute top-6 -right-4 h-6 w-6 text-muted-foreground/50" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Choose the plan that fits your operation. All plans include a 14-day free trial.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border bg-card p-8 ${
                  plan.popular ? "border-primary shadow-lg scale-105" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center rounded-full bg-primary px-4 py-1 text-sm font-medium text-primary-foreground">
                      <Zap className="mr-1 h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block w-full text-center rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                    plan.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border hover:bg-accent"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 sm:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Loved by operations teams
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              See what industry professionals are saying about ShiftSync.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="rounded-2xl border bg-card p-8"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-lg mb-6">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div>
                  <p className="font-semibold">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-primary px-8 py-16 sm:px-16 overflow-hidden">
            <div className="relative z-10 mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                Ready to transform your scheduling?
              </h2>
              <p className="mt-4 text-lg text-primary-foreground/80">
                Join hundreds of operations teams who trust ShiftSync to manage their workforce.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-md bg-white px-8 py-3 text-sm font-medium text-primary shadow hover:bg-gray-100 w-full sm:w-auto"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-md border border-primary-foreground/20 px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10 w-full sm:w-auto"
                >
                  Sign In
                </Link>
              </div>
            </div>
            <div className="absolute inset-0 -z-0 overflow-hidden">
              <div className="absolute -right-20 -top-20 w-[400px] h-[400px] rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -left-20 -bottom-20 w-[400px] h-[400px] rounded-full bg-white/10 blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-6 w-6 text-primary" />
                <span className="font-bold">ShiftSync</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Intelligent workforce scheduling for modern operations.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground">Integrations</a></li>
                <li><a href="#" className="hover:text-foreground">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Blog</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} ShiftSync. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">Twitter</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                <span className="sr-only">LinkedIn</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
