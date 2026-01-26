"use client"

import { useState } from "react"
import { SessionProvider } from "next-auth/react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { ToastProvider } from "@/components/ui/toast"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <SessionProvider>
      <ToastProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

          <div className="lg:pl-64">
            <Header onMenuClick={() => setMobileNavOpen(true)} />
            <main className="p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </SessionProvider>
  )
}
