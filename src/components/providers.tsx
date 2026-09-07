"use client"

import { ThemeProvider } from "next-themes"
import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useEffect, useState } from "react"
import { CookieConsent } from "@/components/cookie-consent"
import { ToastProvider } from "@/components/ui/toast"
import { ConfirmProvider } from "@/components/ui/confirm-dialog"
import { ApiError } from "@/lib/api-client"

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  // One client per browser tab; created lazily so it survives re-renders
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry client errors (400/401/403/404/409)
              if (error instanceof ApiError && error.status < 500) return false
              return failureCount < 2
            },
          },
        },
      })
  )

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker registration failed - app works fine without it
      })
    }
  }, [])

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <ConfirmProvider>
              {children}
              <CookieConsent />
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
