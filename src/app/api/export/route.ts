import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { getYearStartUTC, getYearEndUTC } from "@/lib/timezone"

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
        csv += `"${user.name || ""}","${user.email}","${user.role}","${user.position || ""}","${user.status}","${user.crew?.name || ""}","${user.hireDate?.toISOString().split("T")[0] || ""}"\n`
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
        csv += `"${date}","${schedule.user.name || ""}","${schedule.user.email}","${schedule.shiftType}","${schedule.crew?.name || ""}","${schedule.notes || ""}","${schedule.isOverride}"\n`
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
        csv += `"${crew.name}","${crew.description || ""}","${crew.color}","${crew.rotationPattern?.name || ""}","${crew._count.workers}"\n`
      }
      csv += "\n"

      // Add patterns
      const patterns = await prisma.rotationPattern.findMany({
        where: { organizationId: session.user.organizationId },
      })

      csv += "ROTATION PATTERNS\n"
      csv += "Name,Days On,Days Off,Includes Nights,Night Days,Alternates\n"
      for (const pattern of patterns) {
        csv += `"${pattern.name}","${pattern.daysOn}","${pattern.daysOff}","${pattern.includesNights}","${pattern.nightDays}","${pattern.alternatesShifts}"\n`
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
