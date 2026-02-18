"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import {
  ScanLine,
  Camera,
  CameraOff,
  UserCheck,
  UserMinus,
  Keyboard,
} from "lucide-react"

export default function ScanPage() {
  const { data: session } = useSession()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info")
  const [lastScannedUser, setLastScannedUser] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [manualId, setManualId] = useState("")
  const [showManual, setShowManual] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isAdminOrSupervisor = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR"

  useEffect(() => {
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startCamera = async () => {
    try {
      setCameraError("")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)

      // Start scanning frames for QR-like patterns
      scanIntervalRef.current = setInterval(() => {
        scanFrame()
      }, 500)
    } catch (err) {
      setCameraError(
        "Could not access camera. Please allow camera permissions or use manual entry."
      )
      console.error("Camera error:", err)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    setCameraActive(false)
  }

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx || video.videoWidth === 0) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    // In a production app, use a JS QR code reader library here.
    // For now, this demonstrates the camera feed + manual entry fallback.
  }

  const handleCheckIn = async (userId: string) => {
    if (processing) return
    setProcessing(true)
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message || "Checked in successfully")
        setMessageType("success")
        setLastScannedUser(data.data.user?.name || userId)
      } else {
        setMessage(data.error || "Check-in failed")
        setMessageType(data.error?.includes("Already") ? "info" : "error")
      }
    } catch {
      setMessage("Network error during check-in")
      setMessageType("error")
    } finally {
      setProcessing(false)
      setTimeout(() => setMessage(""), 4000)
    }
  }

  const handleCheckOut = async (userId: string) => {
    if (processing) return
    setProcessing(true)
    try {
      const res = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message || "Checked out successfully")
        setMessageType("success")
        setLastScannedUser(data.data.user?.name || userId)
      } else {
        setMessage(data.error || "Check-out failed")
        setMessageType(data.error?.includes("Already") ? "info" : "error")
      }
    } catch {
      setMessage("Network error during check-out")
      setMessageType("error")
    } finally {
      setProcessing(false)
      setTimeout(() => setMessage(""), 4000)
    }
  }

  const handleManualSubmit = (action: "in" | "out") => {
    const userId = manualId.trim()
    if (!userId) return

    // Handle QR format: "shiftsync:checkin:userId"
    const parsed = userId.startsWith("shiftsync:checkin:")
      ? userId.replace("shiftsync:checkin:", "")
      : userId

    if (action === "in") {
      handleCheckIn(parsed)
    } else {
      handleCheckOut(parsed)
    }
    setManualId("")
  }

  if (!isAdminOrSupervisor) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Scanner</h1>
          <p className="text-muted-foreground">Only supervisors and admins can scan check-in codes</p>
        </div>
        <Alert>
          <AlertDescription>
            Go to <a href="/attendance/qr" className="underline font-medium">My QR Code</a> to view your check-in code.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scan Check-In Code</h1>
        <p className="text-muted-foreground">Scan a worker&apos;s QR code or enter their ID manually</p>
      </div>

      {message && (
        <Alert variant={messageType === "error" ? "destructive" : "default"}>
          <AlertDescription className="flex items-center gap-2">
            {messageType === "success" && <UserCheck className="h-4 w-4 text-green-600" />}
            {message}
          </AlertDescription>
        </Alert>
      )}

      {/* Camera Scanner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Camera Scanner
          </CardTitle>
          <CardDescription>Point camera at a worker&apos;s QR code</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-primary rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br" />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <CameraOff className="h-12 w-12" />
                <p className="text-sm">Camera is off</p>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {cameraError && (
            <p className="text-sm text-destructive">{cameraError}</p>
          )}

          <Button
            onClick={cameraActive ? stopCamera : startCamera}
            variant={cameraActive ? "destructive" : "default"}
            className="w-full"
          >
            {cameraActive ? (
              <><CameraOff className="h-4 w-4 mr-2" /> Stop Camera</>
            ) : (
              <><Camera className="h-4 w-4 mr-2" /> Start Camera</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Manual Entry */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Manual Entry
              </CardTitle>
              <CardDescription>Enter worker ID or scan with barcode reader</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowManual(!showManual)}
            >
              {showManual ? "Hide" : "Show"}
            </Button>
          </div>
        </CardHeader>
        {showManual && (
          <CardContent className="space-y-4">
            <Input
              id="manual-worker-id"
              placeholder="Worker ID or QR code data"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualSubmit("in")
              }}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleManualSubmit("in")}
                disabled={!manualId.trim() || processing}
                className="flex-1"
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Check In
              </Button>
              <Button
                onClick={() => handleManualSubmit("out")}
                disabled={!manualId.trim() || processing}
                variant="outline"
                className="flex-1"
              >
                <UserMinus className="h-4 w-4 mr-2" />
                Check Out
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {lastScannedUser && (
        <div className="text-center">
          <Badge variant="secondary" className="text-sm">
            Last: {lastScannedUser}
          </Badge>
        </div>
      )}
    </div>
  )
}
