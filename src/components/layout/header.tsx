"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect, useRef } from "react"
import { Bell, LogOut, Menu, User, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { useState } from "react"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on Escape
  useEffect(() => {
    if (!showUserMenu) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowUserMenu(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showUserMenu])

  // Focus trap within user menu
  useEffect(() => {
    if (!showUserMenu || !menuRef.current) return

    const focusableElements = menuRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])'
    )
    const firstFocusable = focusableElements[0]
    firstFocusable?.focus()
  }, [showUserMenu])

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </Button>

        {/* Page title area - can be customized per page */}
        <div className="hidden lg:block">
          <h1 className="text-lg font-semibold">Welcome back</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications (3 unread)">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground" aria-hidden="true">
            3
          </span>
        </Button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent transition-colors min-h-[44px]"
            aria-expanded={showUserMenu}
            aria-haspopup="true"
            aria-label="User menu"
          >
            <Avatar
              src={session?.user?.image}
              alt={session?.user?.name || "User"}
              size="sm"
            />
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium">{session?.user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {session?.user?.role?.toLowerCase() || "Member"}
              </p>
            </div>
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
                aria-hidden="true"
              />
              <div
                ref={menuRef}
                className="absolute right-0 top-full mt-2 z-50 w-56 rounded-lg border bg-card shadow-lg"
                role="menu"
                aria-label="User options"
              >
                <div className="p-2">
                  <div className="px-3 py-2 border-b mb-2">
                    <p className="font-medium">{session?.user?.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{session?.user?.email}</p>
                  </div>
                  <a
                    href="/settings"
                    className="flex items-center gap-2 rounded-md px-3 py-3 text-sm hover:bg-accent min-h-[44px]"
                    onClick={() => setShowUserMenu(false)}
                    role="menuitem"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </a>
                  <a
                    href="/settings"
                    className="flex items-center gap-2 rounded-md px-3 py-3 text-sm hover:bg-accent min-h-[44px]"
                    onClick={() => setShowUserMenu(false)}
                    role="menuitem"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </a>
                  <hr className="my-2" />
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-sm text-destructive hover:bg-destructive/10 min-h-[44px]"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
