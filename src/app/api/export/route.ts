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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"

    let csv = ""

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
