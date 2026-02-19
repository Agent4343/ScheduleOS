import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "arial"],
})

export const metadata: Metadata = {
  title: {
    default: "ShiftSync | Offshore Crew Scheduling & Rotation Management Software",
    template: "%s | ShiftSync",
  },
  description:
    "AI-powered workforce scheduling built for offshore oil & gas operations. Manage crew rotations, track certifications, and optimize staffing. Free 14-day trial.",
  keywords: [
    "offshore scheduling",
    "crew rotation software",
    "workforce management",
    "shift scheduling",
    "offshore oil and gas",
    "rotation pattern",
    "14/14 schedule",
    "21/21 rotation",
    "crew management",
    "certification tracking",
  ],
  authors: [{ name: "ShiftSync" }],
  creator: "ShiftSync",
  metadataBase: new URL(process.env.NEXTAUTH_URL || "https://scheduleos-production.up.railway.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "ShiftSync",
    title: "ShiftSync | Offshore Crew Scheduling & Rotation Management Software",
    description:
      "AI-powered workforce scheduling built for offshore oil & gas operations. Manage crew rotations, track certifications, and optimize staffing.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ShiftSync - Workforce Scheduling Made Simple",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ShiftSync | Offshore Crew Scheduling Software",
    description:
      "AI-powered workforce scheduling built for offshore oil & gas operations. Free 14-day trial.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ShiftSync" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "ShiftSync",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description:
                "AI-powered workforce scheduling software for offshore oil & gas operations",
              offers: {
                "@type": "Offer",
                price: "49",
                priceCurrency: "USD",
                priceValidUntil: "2026-12-31",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                ratingCount: "150",
              },
            }),
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
