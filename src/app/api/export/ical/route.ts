import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

function escapeICalText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || session.user.id
    const months = parseInt(searchParams.get("months") || "3")

    // Workers can only export their own schedule
    if (session.user.role === "WORKER" && userId !== session.user.id) {
      return NextResponse.json({ error: "Cannot export another worker's schedule" }, { status: 403 })
    }

    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + months)

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: session.user.organizationId },
      select: { name: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        shiftType: { notIn: ["OFF"] },
      },
      orderBy: { date: "asc" },
    })

    const shiftLabels: Record<string, string> = {
      DAY: "Day Shift",
      NIGHT: "Night Shift",
      LEAVE: "Leave",
      PL_DAY: "Paid Leave (Day)",
      PL_NIGHT: "Paid Leave (Night)",
      VACATION: "Vacation",
      SICK: "Sick Leave",
      TRAINING: "Training",
      SHUTDOWN: "Shutdown",
      CUSTOM: "Custom Shift",
    }

    const now = formatICalDate(new Date())
    const workerName = user.name || user.email

    let ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ShiftSync//Workforce Scheduling//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeICalText(workerName)} - ShiftSync Schedule`,
      `X-WR-TIMEZONE:UTC`,
    ]

    for (const schedule of schedules) {
      const date = new Date(schedule.date)
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      const label = shiftLabels[schedule.shiftType] || schedule.shiftType
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "")
      const nextDateStr = nextDay.toISOString().slice(0, 10).replace(/-/g, "")

      ical.push(
        "BEGIN:VEVENT",
        `UID:${schedule.id}@shiftsync`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `DTEND;VALUE=DATE:${nextDateStr}`,
        `SUMMARY:${escapeICalText(label)}`,
        `DESCRIPTION:${escapeICalText(`${workerName} - ${label}`)}`,
        `CATEGORIES:${escapeICalText(schedule.shiftType)}`,
        "TRANSP:OPAQUE",
        "END:VEVENT"
      )
    }

    ical.push("END:VCALENDAR")

    const calendarContent = ical.join("\r\n")

    return new NextResponse(calendarContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${workerName.replace(/[^a-zA-Z0-9]/g, "_")}_schedule.ics"`,
      },
    })
  } catch (error) {
    console.error("Error exporting iCal:", error)
    return NextResponse.json({ error: "Failed to export calendar" }, { status: 500 })
  }
}
