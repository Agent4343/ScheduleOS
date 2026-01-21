import Link from "next/link"
import { Calendar } from "lucide-react"
import { Footer } from "@/components/layout/footer"

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">ShiftSync</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  )
}
