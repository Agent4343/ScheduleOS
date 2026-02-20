import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Footer } from "@/components/layout/footer"
import {
  Calendar,
  Users,
  Clock,
  Shield,
  BarChart3,
  Bell,
  CheckCircle2,
  ArrowRight,
  Zap,
  Globe,
  Repeat,
} from "lucide-react"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">ShiftSync</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#industries" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Industries
            </Link>
            <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/pricing">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 bg-gradient-to-b from-background to-muted/20">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Zap className="h-3.5 w-3.5" />
              AI-powered scheduling for modern teams
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Workforce Scheduling
              <br />
              <span className="text-primary">Made Simple</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              The all-in-one platform for managing crew rotations, shift schedules, and workforce
              operations. Built for teams that work around the clock.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/pricing">
                <Button size="lg" className="gap-2 text-base px-8">
                  Start Free 14-Day Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="text-base px-8">
                  See Features
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required. Cancel anytime.
            </p>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-12 border-y bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <p className="text-3xl font-bold text-primary">500+</p>
                <p className="text-sm text-muted-foreground mt-1">Teams scheduling</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">12,000+</p>
                <p className="text-sm text-muted-foreground mt-1">Workers managed</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">99.9%</p>
                <p className="text-sm text-muted-foreground mt-1">Uptime SLA</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">4.8/5</p>
                <p className="text-sm text-muted-foreground mt-1">Customer rating</p>
              </div>
            </div>
          </div>
        </section>

        {/* Product Preview Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-3">See It In Action</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                A powerful dashboard that gives you full visibility over every crew, shift, and schedule.
              </p>
            </div>
            <div className="max-w-5xl mx-auto">
              <div className="bg-background rounded-xl shadow-2xl border overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 text-center">
                    <div className="inline-flex items-center gap-2 bg-background rounded px-3 py-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      app.shiftsync.com/schedule
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="h-6 w-40 bg-foreground/10 rounded mb-2" />
                      <div className="h-4 w-56 bg-muted rounded" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-9 w-28 bg-primary/20 rounded" />
                      <div className="h-9 w-36 bg-primary rounded" />
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-8 bg-muted/50">
                      <div className="p-3 border-r font-medium text-sm">Crew</div>
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                        <div key={day} className="p-3 text-center text-sm font-medium border-r last:border-r-0">
                          {day}
                        </div>
                      ))}
                    </div>
                    {[
                      { name: "Alpha", color: "bg-blue-500" },
                      { name: "Bravo", color: "bg-green-500" },
                      { name: "Charlie", color: "bg-amber-500" },
                      { name: "Delta", color: "bg-purple-500" },
                    ].map((crew, i) => (
                      <div key={crew.name} className="grid grid-cols-8 border-t">
                        <div className="p-3 border-r text-sm font-medium flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${crew.color}`} />
                          {crew.name}
                        </div>
                        {[0, 1, 2, 3, 4, 5, 6].map((j) => {
                          const isDay = (i + j) % 3 === 0
                          const isNight = (i + j) % 3 === 1
                          const isOff = !isDay && !isNight
                          return (
                            <div key={j} className="p-1.5 border-r last:border-r-0">
                              <div
                                className={`h-8 rounded text-xs flex items-center justify-center font-medium ${
                                  isDay
                                    ? "bg-blue-500 text-white"
                                    : isNight
                                    ? "bg-indigo-600 text-white"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {isDay ? "Day" : isNight ? "Night" : "Off"}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Everything You Need to Manage Schedules</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Purpose-built features for managing complex rotating schedules, shift work, and workforce operations.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <Repeat className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Rotation Management</CardTitle>
                  <CardDescription>
                    Configure any rotation pattern &mdash; 14/14, 21/21, 4-on/4-off, or fully custom. The system handles the complexity.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <Users className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Crew Coordination</CardTitle>
                  <CardDescription>
                    Organize workers into crews, track who&apos;s on and who&apos;s off, and manage team schedules with full visibility.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <Clock className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Time-Off &amp; Shift Swaps</CardTitle>
                  <CardDescription>
                    Handle vacation requests, sick leave, and shift swaps with automated conflict detection and approval workflows.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <Shield className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Compliance &amp; Certifications</CardTitle>
                  <CardDescription>
                    Track training certifications, expiry dates, and ensure you always meet minimum staffing and regulatory requirements.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <BarChart3 className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Reporting &amp; Analytics</CardTitle>
                  <CardDescription>
                    Get insights into staffing levels, overtime trends, schedule coverage, and workforce utilization at a glance.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <Bell className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Smart Notifications</CardTitle>
                  <CardDescription>
                    Automated alerts for schedule changes, upcoming rotations, certification renewals, and staffing gaps.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Industries Section */}
        <section id="industries" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Built for Industries That Never Stop</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                ShiftSync works wherever teams operate on rotating schedules and shift-based work.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Globe, title: "Oil &amp; Gas", desc: "Offshore platforms, rigs, and field operations" },
                { icon: Shield, title: "Mining", desc: "Remote sites with fly-in/fly-out crews" },
                { icon: Zap, title: "Energy &amp; Utilities", desc: "Power plants, wind farms, and grid operations" },
                { icon: Users, title: "Manufacturing", desc: "24/7 production lines and shift teams" },
              ].map((item) => (
                <div key={item.title} className="text-center p-6 rounded-xl border bg-card hover:shadow-md transition-shadow">
                  <item.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Up and Running in Minutes</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                No consultants, no training sessions. Set up your schedule and go.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  1
                </div>
                <h3 className="font-semibold text-lg mb-2">Set Up Your Teams</h3>
                <p className="text-sm text-muted-foreground">
                  Add your workers, organize them into crews, and define your rotation patterns.
                </p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  2
                </div>
                <h3 className="font-semibold text-lg mb-2">Generate Schedules</h3>
                <p className="text-sm text-muted-foreground">
                  ShiftSync auto-generates schedules based on your rotation rules, staffing requirements, and availability.
                </p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  3
                </div>
                <h3 className="font-semibold text-lg mb-2">Manage &amp; Adjust</h3>
                <p className="text-sm text-muted-foreground">
                  Handle time-off requests, swap shifts, make adjustments, and keep everyone informed automatically.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Choose the plan that fits your operation. All plans include a 14-day free trial.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Starter */}
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle>Starter</CardTitle>
                  <CardDescription>For small teams getting started</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">$49</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 flex-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Up to 25 workers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Basic rotation patterns</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Time-off management</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Email support</span>
                    </li>
                  </ul>
                  <Link href="/register?plan=starter" className="block mt-6">
                    <Button className="w-full" variant="outline">Start Free Trial</Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Professional */}
              <Card className="border-primary ring-2 ring-primary flex flex-col relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-4 py-1 text-sm font-semibold text-primary-foreground">
                    Most Popular
                  </span>
                </div>
                <CardHeader>
                  <CardTitle>Professional</CardTitle>
                  <CardDescription>For growing operations</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">$149</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 flex-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Up to 100 workers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Custom rotation patterns</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">AI scheduling assistant</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Advanced reporting</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Certification tracking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Priority support</span>
                    </li>
                  </ul>
                  <Link href="/register?plan=professional" className="block mt-6">
                    <Button className="w-full">Start Free Trial</Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Enterprise */}
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle>Enterprise</CardTitle>
                  <CardDescription>For large-scale operations</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">Custom</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 flex-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Unlimited workers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">API access</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Custom integrations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">Dedicated support</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">SSO / SAML</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">SLA guarantee</span>
                    </li>
                  </ul>
                  <Link href="/contact" className="block mt-6">
                    <Button className="w-full" variant="outline">Contact Sales</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Simplify Your Scheduling?</h2>
            <p className="max-w-2xl mx-auto mb-8 text-primary-foreground/80">
              Join hundreds of operations teams who have eliminated scheduling headaches with ShiftSync.
              Get started in under 5 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/pricing">
                <Button size="lg" variant="secondary" className="gap-2 text-base px-8">
                  Start Your Free 14-Day Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="text-base px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  Talk to Sales
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
