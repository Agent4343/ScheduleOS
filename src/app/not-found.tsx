"use client"

import Link from "next/link"
import { FileQuestion, Home, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * 404 Not Found page.
 * Displayed when a user navigates to a route that doesn't exist.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900">
              <FileQuestion className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <CardTitle className="text-xl">Page Not Found</CardTitle>
          <CardDescription>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-6xl font-bold text-muted-foreground/20">404</p>
          </div>

          <div className="flex flex-col gap-2">
            <Link href="/dashboard" className="w-full">
              <Button className="w-full">
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => typeof window !== "undefined" && window.history.back()}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
