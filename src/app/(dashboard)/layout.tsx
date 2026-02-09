"use client"

import { useState, useCallback } from "react"
import { SessionProvider } from "next-auth/react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { BottomNav } from "@/components/layout/bottom-nav"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])

  return (
    <SessionProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav isOpen={mobileNavOpen} onClose={closeMobileNav} />

        <div className="lg:pl-64">
          <Header onMenuClick={() => setMobileNavOpen(true)} />
          <main className="p-4 lg:p-6 pb-20 lg:pb-6">
            {children}
          </main>
        </div>

        <BottomNav />
      </div>
    </SessionProvider>
  )
}
