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
  FileSpreadsheet,
  Moon,
  Sun,
  Building2,
  Stethoscope,
  Factory,
  ShieldCheck,
  Utensils,
  Truck,
  Bot,
  MessageSquare,
  Sparkles,
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
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ShiftSync</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#industries" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Industries
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
              <Button size="sm" className="sm:text-sm">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              The modern way to manage shift schedules
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Shift Scheduling
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                That Just Works
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              The all-in-one platform for managing rotating schedules, tracking certifications,
              and ensuring you always have the right people on every shift.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="gap-2 h-12 px-8 text-lg">
                  Start Free Trial
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="#demo">
                <Button size="lg" variant="outline" className="h-12 px-8 text-lg">
                  See Demo
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Free 7-day trial &bull; Setup in 5 minutes
            </p>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 border-y bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-primary mb-1">10k+</div>
                <div className="text-sm text-muted-foreground">Workers Scheduled</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-1">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-1">50%</div>
                <div className="text-sm text-muted-foreground">Time Saved</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-1">24/7</div>
                <div className="text-sm text-muted-foreground">Support</div>
              </div>
            </div>
          </div>
        </section>

        {/* Product Preview Section */}
        <section id="demo" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">See Your Schedule at a Glance</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A full-year calendar view with color-coded shifts, training coverage tracking, and instant exports
              </p>
            </div>
            <div className="max-w-6xl mx-auto">
              <div className="bg-background rounded-2xl shadow-2xl border overflow-hidden">
                {/* Mock Browser Header */}
                <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 text-center">
                    <div className="inline-flex items-center gap-2 bg-background rounded-lg px-4 py-1.5 text-xs text-muted-foreground border">
                      <Globe className="h-3 w-3" />
                      app.shiftsync.com/schedule
                    </div>
                  </div>
                </div>
                {/* Mock Dashboard Content */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-lg font-semibold">2026 Schedule</div>
                      <div className="text-sm text-muted-foreground">42 Workers &bull; 4 Crews</div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-lg text-sm">
                        <FileSpreadsheet className="h-4 w-4" />
                        Export
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm">
                        Focus Mode
                      </div>
                    </div>
                  </div>
                  {/* Mock Schedule Grid */}
                  <div className="border rounded-xl overflow-x-auto">
                    <div className="min-w-[600px]">
                      <div className="grid grid-cols-[200px_repeat(14,1fr)] bg-muted/50 text-sm">
                        <div className="p-3 border-r font-medium">Worker</div>
                        <div className="p-2 text-center border-r col-span-3 font-medium">January</div>
                        <div className="p-2 text-center border-r col-span-4 font-medium">February</div>
                        <div className="p-2 text-center border-r col-span-4 font-medium">March</div>
                        <div className="p-2 text-center col-span-3 font-medium">April</div>
                      </div>
                      <div className="grid grid-cols-[200px_repeat(14,1fr)] bg-muted/30 text-xs border-t">
                        <div className="p-2 border-r"></div>
                        {[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map((d) => (
                          <div key={d} className="p-1 text-center border-r last:border-r-0 text-muted-foreground">{d}</div>
                        ))}
                      </div>
                      {[
                        { name: "John Smith", crew: "Alpha", pattern: ["D","D","D","N","N","N","O","O","D","D","D","N","N","N"] },
                        { name: "Sarah Johnson", crew: "Alpha", pattern: ["D","D","N","N","N","O","O","D","D","D","N","N","N","O"] },
                        { name: "Mike Williams", crew: "Bravo", pattern: ["N","N","O","O","D","D","D","N","N","O","O","D","D","D"] },
                        { name: "Emily Davis", crew: "Bravo", pattern: ["O","O","D","D","D","N","N","O","O","D","D","D","N","N"] },
                      ].map((worker, i) => (
                        <div key={i} className="grid grid-cols-[200px_repeat(14,1fr)] border-t text-sm">
                          <div className="p-2 border-r flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                              {worker.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium text-xs">{worker.name}</div>
                              <div className="text-[10px] text-muted-foreground">{worker.crew}</div>
                            </div>
                          </div>
                          {worker.pattern.map((shift, j) => (
                            <div key={j} className="p-1 border-r last:border-r-0 flex items-center justify-center">
                              <div
                                className={`w-full h-6 rounded text-[10px] flex items-center justify-center font-bold ${
                                  shift === "D"
                                    ? "bg-green-500 text-white"
                                    : shift === "N"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-500"
                                }`}
                              >
                                {shift}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                      {/* Training row */}
                      <div className="grid grid-cols-[200px_repeat(14,1fr)] border-t bg-amber-50 text-sm">
                        <div className="p-2 border-r text-xs font-medium text-amber-800">Day - Lead Trained</div>
                        {[2,2,1,1,1,1,1,2,2,1,1,1,1,1].map((count, j) => (
                          <div key={j} className="p-1 border-r last:border-r-0 flex items-center justify-center">
                            <div className={`w-full h-6 rounded text-[10px] flex items-center justify-center font-bold ${
                              count >= 1 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}>
                              {count}
                            </div>
                          </div>
                        ))}
                      </div>
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
              <h2 className="text-3xl font-bold mb-4">Everything You Need to Manage Shifts</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Powerful features designed to save you hours every week and ensure you never miss coverage.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mb-4">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <CardTitle>Full Year Calendar</CardTitle>
                  <CardDescription>
                    See your entire year at a glance. Color-coded shifts make it easy to spot patterns and gaps.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                    <Users className="h-6 w-6" />
                  </div>
                  <CardTitle>Crew Management</CardTitle>
                  <CardDescription>
                    Organize workers into crews with different rotation patterns. Auto-generate schedules in seconds.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6" />
                  </div>
                  <CardTitle>Training Tracking</CardTitle>
                  <CardDescription>
                    Track certifications and training. Get alerts when coverage requirements aren&apos;t met.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
                    <Clock className="h-6 w-6" />
                  </div>
                  <CardTitle>Time-Off Management</CardTitle>
                  <CardDescription>
                    Handle vacation, sick leave, and schedule overrides. Workers can request time off directly.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center mb-4">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <CardTitle>Excel Export</CardTitle>
                  <CardDescription>
                    Export your schedule to Excel with colors intact. Perfect for sharing with stakeholders.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center mb-4">
                    <Bell className="h-6 w-6" />
                  </div>
                  <CardTitle>Smart Alerts</CardTitle>
                  <CardDescription>
                    Get notified about staffing gaps, certification expirations, and schedule conflicts.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Day/Night Coverage Feature */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <div>
                <h2 className="text-3xl font-bold mb-4">
                  Never Miss Coverage on Day or Night Shifts
                </h2>
                <p className="text-muted-foreground mb-6">
                  ShiftSync automatically tracks how many trained workers you have on each shift.
                  Red alerts show you immediately when you&apos;re short-staffed.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sun className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">Day Shift Coverage</div>
                      <div className="text-sm text-muted-foreground">Track trained workers for each position type during day shifts</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Moon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">Night Shift Coverage</div>
                      <div className="text-sm text-muted-foreground">Same visibility for overnight crews and rotations</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">Instant Gap Detection</div>
                      <div className="text-sm text-muted-foreground">See red alerts when minimum requirements aren&apos;t met</div>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="bg-muted/30 rounded-2xl p-6 border">
                <div className="text-sm font-medium mb-4">Training Coverage Summary</div>
                <div className="space-y-3">
                  {[
                    { label: "Day - Shift Lead", count: 2, met: true },
                    { label: "Day - Machine Operator", count: 2, met: true },
                    { label: "Day - Safety Certified", count: 1, met: true },
                    { label: "Day - Control Room", count: 0, met: false },
                    { label: "Night - Shift Lead", count: 3, met: true },
                    { label: "Night - Control Room", count: 1, met: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                      <span className="text-sm">{item.label}</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        item.met ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {item.met ? item.count : "! Need 1"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Assistant Section */}
        <section className="py-20 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                Powered by AI
              </div>
              <h2 className="text-3xl font-bold mb-4">Meet Your AI Scheduling Assistant</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Manage your entire schedule using natural language. Just ask, and your AI assistant handles the rest.
              </p>
            </div>
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <div className="bg-background rounded-2xl border shadow-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <span className="font-medium">AI Assistant</span>
                </div>
                <div className="p-6 space-y-4">
                  {/* Example conversations */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium">You</span>
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2 text-sm">
                      Who&apos;s working day shift tomorrow?
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-primary/10 rounded-2xl rounded-tl-sm px-4 py-2 text-sm">
                      Tomorrow&apos;s day shift has 6 workers: John Smith, Sarah Johnson, Mike Williams, Emily Davis, Chris Brown, and Lisa Anderson. All certification requirements are met.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium">You</span>
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2 text-sm">
                      Swap John and Mike&apos;s shifts on Friday
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-primary/10 rounded-2xl rounded-tl-sm px-4 py-2 text-sm">
                      Done! I&apos;ve swapped their shifts. John is now on night shift and Mike is on day shift for Friday, January 31st.
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-6">Everything You Can Do With AI</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">View Schedules Instantly</div>
                      <div className="text-sm text-muted-foreground">&quot;Who&apos;s working this week?&quot; or &quot;Show me the night shift for January&quot;</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">Swap & Update Shifts</div>
                      <div className="text-sm text-muted-foreground">&quot;Move Sarah to night shift on Tuesday&quot; or &quot;Swap John and Mike&apos;s shifts&quot;</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">Handle Time-Off Requests</div>
                      <div className="text-sm text-muted-foreground">&quot;Approve Sarah&apos;s vacation request&quot; or &quot;Show pending time-off requests&quot;</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">Get Daily & Weekly Summaries</div>
                      <div className="text-sm text-muted-foreground">&quot;Give me today&apos;s summary&quot; or &quot;What does next week look like?&quot;</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">Natural Language Control</div>
                      <div className="text-sm text-muted-foreground">No menus or buttons to learn. Just type what you need in plain English.</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Industries Section */}
        <section id="industries" className="py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Built for Every Shift-Based Industry</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Whether you&apos;re managing a hospital, factory, warehouse, or security team — ShiftSync adapts to your needs.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
              {[
                { icon: Factory, label: "Manufacturing" },
                { icon: Stethoscope, label: "Healthcare" },
                { icon: Building2, label: "Utilities" },
                { icon: ShieldCheck, label: "Security" },
                { icon: Utensils, label: "Hospitality" },
                { icon: Truck, label: "Logistics" },
              ].map((industry, i) => (
                <div key={i} className="flex flex-col items-center gap-3 p-6 bg-background rounded-xl border hover:border-primary/50 hover:shadow-md transition-all">
                  <industry.icon className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium text-center">{industry.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Simple, Honest Pricing</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                No hidden fees. No long-term contracts. Just powerful scheduling software that pays for itself.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Starter */}
              <Card className="relative">
                <CardHeader>
                  <CardTitle>Starter</CardTitle>
                  <CardDescription>For small teams</CardDescription>
                  <div className="mt-4">
                    <span className="text-5xl font-bold">$29</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Up to 25 workers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Unlimited schedules</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Time-off management</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Excel export</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Email support</span>
                    </li>
                  </ul>
                  <Link href="/register" className="block mt-8">
                    <Button className="w-full" variant="outline" size="lg">Start Free Trial</Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Professional */}
              <Card className="relative border-2 border-primary shadow-xl scale-105">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
                <CardHeader>
                  <CardTitle>Professional</CardTitle>
                  <CardDescription>For growing teams</CardDescription>
                  <div className="mt-4">
                    <span className="text-5xl font-bold">$79</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Up to 100 workers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">AI Assistant</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Training tracking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Coverage alerts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Custom shift types</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Priority support</span>
                    </li>
                  </ul>
                  <Link href="/register" className="block mt-8">
                    <Button className="w-full" size="lg">Start Free Trial</Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Enterprise */}
              <Card className="relative">
                <CardHeader>
                  <CardTitle>Enterprise</CardTitle>
                  <CardDescription>For large operations</CardDescription>
                  <div className="mt-4">
                    <span className="text-5xl font-bold">$199</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Unlimited workers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">AI Assistant</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Multiple departments</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Separate calendars per team</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>API access</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Dedicated support</span>
                    </li>
                  </ul>
                  <Link href="/contact" className="block mt-8">
                    <Button className="w-full" variant="outline" size="lg">Contact Sales</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-8">
              All plans include a 7-day free trial. Credit card required to start.
            </p>
          </div>
        </section>

        {/* Testimonial/Social Proof */}
        <section className="py-20 bg-muted/50">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-3xl mx-auto">
              <div className="text-6xl mb-6">&ldquo;</div>
              <p className="text-xl md:text-2xl mb-6 italic">
                ShiftSync cut our scheduling time from 4 hours to 15 minutes.
                The training coverage tracking alone has prevented countless staffing emergencies.
              </p>
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-bold">
                  JD
                </div>
                <div className="text-left">
                  <div className="font-semibold">James Davidson</div>
                  <div className="text-sm text-muted-foreground">Operations Manager</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center bg-primary rounded-3xl p-12 text-primary-foreground">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Simplify Your Scheduling?
              </h2>
              <p className="text-primary-foreground/80 max-w-2xl mx-auto mb-8 text-lg">
                Join thousands of teams who have eliminated scheduling headaches.
                Get started in minutes, not days.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button size="lg" variant="secondary" className="gap-2 h-12 px-8 text-lg">
                    Start Your Free Trial
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
              <p className="text-primary-foreground/60 text-sm mt-4">
                Free 7-day trial &bull; Cancel anytime
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
