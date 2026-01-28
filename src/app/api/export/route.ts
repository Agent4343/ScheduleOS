import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { getYearStartUTC, getYearEndUTC } from "@/lib/timezone"

// Sanitize CSV values to prevent injection attacks
function sanitizeCSVValue(value: string | null | undefined): string {
  if (!value) return ""

  // Convert to string and remove potential formula injection characters
  let sanitized = String(value)

  // If value starts with special chars that could be interpreted as formulas, prefix with single quote
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = "'" + sanitized
  }

  return sanitized
}

// Get all days in a year
function getYearDays(year: number): { month: number; day: number; dateStr: string }[] {
  const days: { month: number; day: number; dateStr: string }[] = []
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      days.push({ month, day, dateStr })
    }
  }
  return days
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()))

    let csv = ""

    // Schedule Grid Export - Excel-like format matching the schedule page
    if (type === "schedule-grid") {
      const startDate = getYearStartUTC(year)
      const endDate = getYearEndUTC(year)

      // Fetch all workers with training certifications
      const users = await prisma.user.findMany({
        where: {
          organizationId: session.user.organizationId,
          status: "ACTIVE",
        },
        include: { crew: true },
        orderBy: [{ sortOrder: "asc" }, { crew: { name: "asc" } }, { name: "asc" }],
      })

      // Fetch all schedules for the year
      const schedules = await prisma.schedule.findMany({
        where: {
          user: { organizationId: session.user.organizationId },
          date: { gte: startDate, lte: endDate },
        },
        select: {
          userId: true,
          date: true,
          shiftType: true,
          customShiftCode: true,
        },
      })

      // Build schedule lookup map
      const scheduleMap = new Map<string, string>()
      for (const schedule of schedules) {
        const dateStr = schedule.date.toISOString().split("T")[0]
        const key = `${schedule.userId}-${dateStr}`
        const shiftLabel = schedule.shiftType === "CUSTOM" && schedule.customShiftCode
          ? schedule.customShiftCode
          : schedule.shiftType.charAt(0) // D, N, O, L, V, S, T, X
        scheduleMap.set(key, shiftLabel)
      }

      // Get all days in the year
      const yearDays = getYearDays(year)

      // Build header row with month groupings
      let headerRow1 = "Worker,Crew"
      let headerRow2 = ","
      let currentMonth = -1
      for (const { month, day } of yearDays) {
        if (month !== currentMonth) {
          headerRow1 += `,${MONTH_NAMES[month]}`
          currentMonth = month
        } else {
          headerRow1 += ","
        }
        headerRow2 += `,${day}`
      }
      csv += headerRow1 + "\n"
      csv += headerRow2 + "\n"

      // Add worker rows
      for (const user of users) {
        let row = `"${sanitizeCSVValue(user.name)}","${sanitizeCSVValue(user.crew?.name)}"`
        for (const { dateStr } of yearDays) {
          const key = `${user.id}-${dateStr}`
          const shift = scheduleMap.get(key) || ""
          row += `,${shift}`
        }
        csv += row + "\n"
      }

      // Add training summary rows
      const trainingLabels = [
        { label: "Day - Oil Op Trained", field: "isOilOperatorTrained", shift: "DAY" },
        { label: "Day - Utility Op Trained", field: "isUtilityOperatorTrained", shift: "DAY" },
        { label: "Day - Gas Op Trained", field: "isGasOperatorTrained", shift: "DAY" },
        { label: "Day - CR Trained", field: "isControlRoomTrained", shift: "DAY" },
        { label: "Night - Oil Op Trained", field: "isOilOperatorTrained", shift: "NIGHT" },
        { label: "Night - Utility Op Trained", field: "isUtilityOperatorTrained", shift: "NIGHT" },
        { label: "Night - Gas Op Trained", field: "isGasOperatorTrained", shift: "NIGHT" },
        { label: "Night - CR Trained", field: "isControlRoomTrained", shift: "NIGHT" },
      ]

      csv += "\n"
      for (const { label, field, shift } of trainingLabels) {
        let row = `"${label}",`
        for (const { dateStr } of yearDays) {
          // Count workers with this training on this shift
          let count = 0
          for (const user of users) {
            const key = `${user.id}-${dateStr}`
            const workerShift = scheduleMap.get(key)
            const isOnShift = shift === "DAY"
              ? (workerShift === "D" || workerShift === "DAY" || workerShift === "PL_DAY")
              : (workerShift === "N" || workerShift === "NIGHT" || workerShift === "PL_NIGHT")
            if (isOnShift && (user as Record<string, unknown>)[field]) {
              count++
            }
          }
          row += `,${count > 0 ? count : ""}`
        }
        csv += row + "\n"
      }

      // Add total on duty row
      let totalRow = `"Total On Duty",`
      for (const { dateStr } of yearDays) {
        let count = 0
        for (const user of users) {
          const key = `${user.id}-${dateStr}`
          const shift = scheduleMap.get(key)
          if (shift && !["O", "OFF"].includes(shift)) {
            count++
          }
        }
        totalRow += `,${count > 0 ? count : ""}`
      }
      csv += totalRow + "\n"

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="schedule-${year}.csv"`,
        },
      })
    }

    if (type === "workers" || type === "all") {
      const users = await prisma.user.findMany({
        where: { organizationId: session.user.organizationId },
        include: { crew: true },
        orderBy: { name: "asc" },
      })

      csv += "WORKERS\n"
      csv += "Name,Email,Role,Position,Status,Crew,Hire Date\n"
      for (const user of users) {
        csv += `"${sanitizeCSVValue(user.name)}","${sanitizeCSVValue(user.email)}","${sanitizeCSVValue(user.role)}","${sanitizeCSVValue(user.position)}","${sanitizeCSVValue(user.status)}","${sanitizeCSVValue(user.crew?.name)}","${sanitizeCSVValue(user.hireDate?.toISOString().split("T")[0])}"\n`
      }
      csv += "\n"
    }

    if (type === "schedules" || type === "all") {
      // Get schedules for the current year using UTC dates
      const currentYear = new Date().getFullYear()
      const startDate = getYearStartUTC(currentYear)
      const endDate = getYearEndUTC(currentYear)

      const schedules = await prisma.schedule.findMany({
        where: {
          user: { organizationId: session.user.organizationId },
          date: { gte: startDate, lte: endDate },
        },
        include: {
          user: { select: { name: true, email: true } },
          crew: { select: { name: true } },
        },
        orderBy: [{ date: "asc" }, { user: { name: "asc" } }],
      })

      csv += "SCHEDULES\n"
      csv += "Date,Worker,Email,Shift Type,Crew,Notes,Is Override\n"
      for (const schedule of schedules) {
        const date = schedule.date.toISOString().split("T")[0]
        csv += `"${sanitizeCSVValue(date)}","${sanitizeCSVValue(schedule.user.name)}","${sanitizeCSVValue(schedule.user.email)}","${sanitizeCSVValue(schedule.shiftType)}","${sanitizeCSVValue(schedule.crew?.name)}","${sanitizeCSVValue(schedule.notes)}","${sanitizeCSVValue(String(schedule.isOverride))}"\n`
      }
      csv += "\n"
    }

    if (type === "all") {
      // Add crews
      const crews = await prisma.crew.findMany({
        where: { organizationId: session.user.organizationId },
        include: { rotationPattern: true, _count: { select: { workers: true } } },
      })

      csv += "CREWS\n"
      csv += "Name,Description,Color,Pattern,Workers\n"
      for (const crew of crews) {
        csv += `"${sanitizeCSVValue(crew.name)}","${sanitizeCSVValue(crew.description)}","${sanitizeCSVValue(crew.color)}","${sanitizeCSVValue(crew.rotationPattern?.name)}","${sanitizeCSVValue(String(crew._count.workers))}"\n`
      }
      csv += "\n"

      // Add patterns
      const patterns = await prisma.rotationPattern.findMany({
        where: { organizationId: session.user.organizationId },
      })

      csv += "ROTATION PATTERNS\n"
      csv += "Name,Days On,Days Off,Includes Nights,Night Days,Alternates\n"
      for (const pattern of patterns) {
        csv += `"${sanitizeCSVValue(pattern.name)}","${sanitizeCSVValue(String(pattern.daysOn))}","${sanitizeCSVValue(String(pattern.daysOff))}","${sanitizeCSVValue(String(pattern.includesNights))}","${sanitizeCSVValue(String(pattern.nightDays))}","${sanitizeCSVValue(String(pattern.alternatesShifts))}"\n`
      }
    }

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="schedule-export-${type}-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("Error exporting data:", error)
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 })
  }
}
