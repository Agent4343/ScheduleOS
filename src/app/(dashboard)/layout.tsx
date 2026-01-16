"use client"

import { useState } from "react"
import { SessionProvider } from "next-auth/react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { DesktopProvider } from "@/components/providers/desktop-provider"
import { OfflineBanner } from "@/components/desktop/sync-status"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <SessionProvider>
      <DesktopProvider>
        <div className="min-h-screen bg-background">
          <OfflineBanner />
          <Sidebar />
          <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

          <div className="lg:pl-64">
            <Header onMenuClick={() => setMobileNavOpen(true)} />
            <main className="p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </DesktopProvider>
    </SessionProvider>
  )
}
