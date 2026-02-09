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
            <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="sm:text-sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="sm:text-sm">Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Workforce Scheduling
              <br />
              <span className="text-primary">Made Simple</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              AI-powered crew scheduling built for offshore oil &amp; gas operations.
              Manage rotations, track certifications, and optimize staffing with ease.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Start Free 14-Day Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline">
                  See Features
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required. Cancel anytime.
            </p>
          </div>
        </section>

        {/* Product Preview Section */}
        <section className="py-12 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">See It In Action</h2>
              <p className="text-muted-foreground">
                A powerful dashboard designed for offshore operations teams
              </p>
            </div>
            <div className="max-w-5xl mx-auto">
              <div className="bg-background rounded-xl shadow-2xl border overflow-hidden">
                {/* Mock Browser Header */}
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
                {/* Mock Dashboard Content */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="h-6 w-32 bg-foreground/10 rounded mb-2" />
                      <div className="h-4 w-48 bg-muted rounded" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-9 w-24 bg-primary/20 rounded" />
                      <div className="h-9 w-32 bg-primary rounded" />
                    </div>
                  </div>
                  {/* Mock Schedule Grid */}
                  <div className="border rounded-lg overflow-x-auto">
                    <div className="min-w-[500px]">
                      <div className="grid grid-cols-8 bg-muted/50">
                        <div className="p-2 sm:p-3 border-r font-medium text-xs sm:text-sm">Crew</div>
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                          <div key={day} className="p-2 sm:p-3 text-center text-xs sm:text-sm font-medium border-r last:border-r-0">
                            {day}
                          </div>
                        ))}
                      </div>
                      {["Alpha", "Bravo", "Charlie"].map((crew, i) => (
                        <div key={crew} className="grid grid-cols-8 border-t">
                          <div className="p-2 sm:p-3 border-r text-xs sm:text-sm font-medium">{crew}</div>
                          {[0, 1, 2, 3, 4, 5, 6].map((j) => (
                            <div key={j} className="p-1.5 sm:p-2 border-r last:border-r-0">
                              <div
                                className={`h-7 sm:h-8 rounded text-xs flex items-center justify-center text-white font-medium ${
                                  (i + j) % 3 === 0
                                    ? "bg-green-500"
                                    : (i + j) % 3 === 1
                                    ? "bg-blue-500"
                                    : "bg-muted"
                                }`}
                              >
                                {(i + j) % 3 === 0 ? "Day" : (i + j) % 3 === 1 ? "Night" : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
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
              <h2 className="text-3xl font-bold mb-4">Built for Offshore Operations</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Purpose-built features for managing complex rotating schedules in offshore environments.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <Calendar className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Rotation Management</CardTitle>
                  <CardDescription>
                    Easily configure and manage complex rotation patterns like 14/14, 21/21, or custom schedules.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <Users className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Crew Coordination</CardTitle>
                  <CardDescription>
                    Organize workers into crews and manage team schedules with full visibility across your operation.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <Clock className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Time-Off Tracking</CardTitle>
                  <CardDescription>
                    Handle vacation requests, sick leave, and schedule overrides with automated conflict detection.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <Shield className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Compliance Ready</CardTitle>
                  <CardDescription>
                    Track training certifications, HUET/BST expiry dates, and ensure regulatory compliance.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <BarChart3 className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Reporting &amp; Analytics</CardTitle>
                  <CardDescription>
                    Get insights into staffing levels, overtime trends, and schedule coverage with built-in reports.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <Bell className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Smart Notifications</CardTitle>
                  <CardDescription>
                    Automated alerts for schedule changes, upcoming rotations, and certification renewals.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">How It Works</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Get your team scheduled in minutes, not hours.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  1
                </div>
                <h3 className="font-semibold mb-2">Set Up Your Crews</h3>
                <p className="text-sm text-muted-foreground">
                  Add your workers, organize them into crews, and define your rotation patterns.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  2
                </div>
                <h3 className="font-semibold mb-2">Generate Schedules</h3>
                <p className="text-sm text-muted-foreground">
                  Let ShiftSync automatically generate schedules based on your rotation rules.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  3
                </div>
                <h3 className="font-semibold mb-2">Manage &amp; Adjust</h3>
                <p className="text-sm text-muted-foreground">
                  Handle time-off requests, make adjustments, and keep everyone informed.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Choose the plan that fits your operation. All plans include a 14-day free trial.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Starter */}
              <Card>
                <CardHeader>
                  <CardTitle>Starter</CardTitle>
                  <CardDescription>For small teams getting started</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">$49</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Up to 25 workers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Basic rotation patterns</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Time-off management</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Email support</span>
                    </li>
                  </ul>
                  <Link href="/register" className="block mt-6">
                    <Button className="w-full" variant="outline">Start Free Trial</Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Professional */}
              <Card className="border-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Professional</CardTitle>
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Popular</span>
                  </div>
                  <CardDescription>For growing operations</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">$149</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Up to 100 workers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Custom rotation patterns</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Advanced reporting</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Certification tracking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Priority support</span>
                    </li>
                  </ul>
                  <Link href="/register" className="block mt-6">
                    <Button className="w-full">Start Free Trial</Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Enterprise */}
              <Card>
                <CardHeader>
                  <CardTitle>Enterprise</CardTitle>
                  <CardDescription>For large-scale operations</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">Custom</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Unlimited workers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">API access</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Custom integrations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Dedicated support</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
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
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Simplify Your Scheduling?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
              Join operations teams who have eliminated scheduling headaches with ShiftSync.
            </p>
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Start Your Free 14-Day Trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
