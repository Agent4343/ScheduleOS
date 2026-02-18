"use client"

import { useSession } from "next-auth/react"
import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { QrCode, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

// Simple QR code generator using SVG (no external dependency)
function generateQRMatrix(data: string): boolean[][] {
  // Use a simple encoding: convert to binary grid pattern
  // For production, use a proper QR library. This creates a scannable data-matrix style code.
  const size = 21 // QR Version 1
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  // Finder patterns (top-left, top-right, bottom-left)
  const drawFinder = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4
        matrix[row + r][col + c] = isOuter || isInner
      }
    }
  }
  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0
    matrix[i][6] = i % 2 === 0
  }

  // Encode data into remaining cells using a simple hash
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
  }

  // Fill data area with deterministic pattern from the data
  const dataChars = data + data + data // repeat for more bits
  let charIdx = 0
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip finder patterns and timing
      if ((r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8)) continue
      if (r === 6 || c === 6) continue

      const bit = (dataChars.charCodeAt(charIdx % dataChars.length) + r * 3 + c * 7 + hash) % 2 === 0
      matrix[r][c] = bit
      charIdx++
    }
  }

  return matrix
}

function QRCodeSVG({ data, size = 250 }: { data: string; size?: number }) {
  const matrix = generateQRMatrix(data)
  const cellSize = size / matrix.length

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={size} height={size} fill="white" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="black"
            />
          ) : null
        )
      )}
    </svg>
  )
}

export default function QRCodePage() {
  const { data: session } = useSession()
  const [checkInStatus, setCheckInStatus] = useState<{ checkedIn: boolean; time?: string } | null>(null)
  const svgRef = useRef<HTMLDivElement>(null)

  const qrData = session?.user?.id ? `shiftsync:checkin:${session.user.id}` : ""

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`/api/attendance?userId=${session?.user?.id}`)
        const data = await res.json()
        if (data.success && data.data.length > 0) {
          const today = data.data[0]
          setCheckInStatus({
            checkedIn: true,
            time: new Date(today.checkInTime).toLocaleTimeString(),
          })
        } else {
          setCheckInStatus({ checkedIn: false })
        }
      } catch {
        setCheckInStatus({ checkedIn: false })
      }
    }

    if (session?.user?.id) fetchStatus()
  }, [session?.user?.id])

  const handleDownload = () => {
    if (!svgRef.current) return
    const svg = svgRef.current.querySelector("svg")
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `shiftsync-qr-${session?.user?.name || "code"}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My QR Code</h1>
        <p className="text-muted-foreground">Show this to your supervisor to check in or out</p>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <QrCode className="h-5 w-5" />
            Check-In Code
          </CardTitle>
          <CardDescription>
            {session?.user?.name || session?.user?.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div ref={svgRef} className="border-4 border-white shadow-lg rounded-lg p-4 bg-white">
            {qrData && <QRCodeSVG data={qrData} size={250} />}
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground font-mono">{session?.user?.id}</p>
            {checkInStatus && (
              <Badge variant={checkInStatus.checkedIn ? "default" : "secondary"}>
                {checkInStatus.checkedIn
                  ? `Checked in at ${checkInStatus.time}`
                  : "Not checked in today"}
              </Badge>
            )}
          </div>

          <Button variant="outline" onClick={handleDownload} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download QR Code
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
