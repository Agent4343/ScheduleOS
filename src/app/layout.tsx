import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "ShiftSync - AI-Powered Workforce Scheduling",
  description: "Comprehensive workforce scheduling platform for industries with complex rotating shift patterns",
  keywords: ["scheduling", "workforce", "shift management", "crew rotation", "offshore", "manufacturing"],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
