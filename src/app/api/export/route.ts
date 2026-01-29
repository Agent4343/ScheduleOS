import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { getYearStartUTC, getYearEndUTC } from "@/lib/timezone"
import ExcelJS from "exceljs"

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

// Shift colors matching the schedule page
const SHIFT_COLORS: Record<string, { bg: string; text: string }> = {
  D: { bg: "22c55e", text: "ffffff" },      // Day - green
  DAY: { bg: "22c55e", text: "ffffff" },
  N: { bg: "2563eb", text: "ffffff" },      // Night - blue
  NIGHT: { bg: "2563eb", text: "ffffff" },
  O: { bg: "e5e7eb", text: "6b7280" },      // Off - gray
  OFF: { bg: "e5e7eb", text: "6b7280" },
  L: { bg: "f97316", text: "ffffff" },      // Leave - orange
  LEAVE: { bg: "f97316", text: "ffffff" },
  P: { bg: "14b8a6", text: "ffffff" },      // PL Day - teal
  PL_DAY: { bg: "14b8a6", text: "ffffff" },
  PL_NIGHT: { bg: "6366f1", text: "ffffff" }, // PL Night - indigo
  V: { bg: "10b981", text: "ffffff" },      // Vacation - emerald
  VACATION: { bg: "10b981", text: "ffffff" },
  S: { bg: "ef4444", text: "ffffff" },      // Sick - red
  SICK: { bg: "ef4444", text: "ffffff" },
  T: { bg: "eab308", text: "000000" },      // Training - yellow
  TRAINING: { bg: "eab308", text: "000000" },
  X: { bg: "64748b", text: "ffffff" },      // Shutdown - slate
  SHUTDOWN: { bg: "64748b", text: "ffffff" },
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()))

    // Schedule Grid Export - Excel format with colors
    if (type === "schedule-grid") {
      const startDate = getYearStartUTC(year)
      const endDate = getYearEndUTC(year)

      // Fetch all workers with their certifications
      const users = await prisma.user.findMany({
        where: {
          organizationId: session.user.organizationId,
          status: "ACTIVE",
        },
        include: {
          crew: true,
          certifications: {
            include: { certificationType: true }
          }
        },
        orderBy: [{ sortOrder: "asc" }, { crew: { name: "asc" } }, { name: "asc" }],
      })

      // Fetch organization's certification types
      const certificationTypes = await prisma.certificationType.findMany({
        where: {
          organizationId: session.user.organizationId,
          isActive: true,
        },
        orderBy: { name: "asc" },
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

      // Build schedule lookup map with full shift type for coloring
      const scheduleMap = new Map<string, { label: string; shiftType: string }>()
      for (const schedule of schedules) {
        const dateStr = schedule.date.toISOString().split("T")[0]
        const key = `${schedule.userId}-${dateStr}`
        const label = schedule.shiftType === "CUSTOM" && schedule.customShiftCode
          ? schedule.customShiftCode
          : schedule.shiftType.charAt(0)
        scheduleMap.set(key, { label, shiftType: schedule.shiftType })
      }

      // Get all days in the year
      const yearDays = getYearDays(year)

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook()
      workbook.creator = "ScheduleOS"
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet(`Schedule ${year}`, {
        views: [{ state: "frozen", xSplit: 2, ySplit: 2 }],
      })

      // Build month header row
      const monthRow: string[] = ["Worker", "Crew"]
      let currentMonth = -1
      for (const { month } of yearDays) {
        if (month !== currentMonth) {
          monthRow.push(MONTH_NAMES[month])
          currentMonth = month
        } else {
          monthRow.push("")
        }
      }
      worksheet.addRow(monthRow)

      // Build day header row
      const dayRow: (string | number)[] = ["", ""]
      for (const { day } of yearDays) {
        dayRow.push(day)
      }
      worksheet.addRow(dayRow)

      // Style header rows
      const headerRow1 = worksheet.getRow(1)
      const headerRow2 = worksheet.getRow(2)
      headerRow1.font = { bold: true }
      headerRow2.font = { bold: true }
      headerRow1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "f3f4f6" } }
      headerRow2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "e5e7eb" } }

      // Add worker rows with colored cells
      for (const user of users) {
        const row: (string | number)[] = [user.name || "", user.crew?.name || ""]

        for (const { dateStr } of yearDays) {
          const key = `${user.id}-${dateStr}`
          const schedule = scheduleMap.get(key)
          row.push(schedule?.label || "")
        }

        const excelRow = worksheet.addRow(row)

        // Apply colors to shift cells
        let colIndex = 3 // Start after Worker and Crew columns
        for (const { dateStr } of yearDays) {
          const key = `${user.id}-${dateStr}`
          const schedule = scheduleMap.get(key)

          if (schedule) {
            const colors = SHIFT_COLORS[schedule.shiftType] || SHIFT_COLORS[schedule.label]
            if (colors) {
              const cell = excelRow.getCell(colIndex)
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: colors.bg },
              }
              cell.font = { color: { argb: colors.text }, bold: true }
              cell.alignment = { horizontal: "center" }
            }
          }
          colIndex++
        }
      }

      // Add empty row before summary
      worksheet.addRow([])

      // Build user certification lookup
      const userCertMap = new Map<string, Set<string>>()
      for (const user of users) {
        const certIds = new Set<string>(user.certifications.map((c: { certificationTypeId: string }) => c.certificationTypeId))
        userCertMap.set(user.id, certIds)
      }

      // Add certification summary rows (only if organization has certifications configured)
      if (certificationTypes.length > 0) {
        // Generate colors for certifications
        const certColors = ["fef3c7", "cffafe", "fed7aa", "e9d5ff", "fde68a", "a5f3fc", "fdba74", "d8b4fe"]

        for (const shift of ["DAY", "NIGHT"]) {
          for (let i = 0; i < certificationTypes.length; i++) {
            const cert = certificationTypes[i]
            const label = `${shift === "DAY" ? "Day" : "Night"} - ${cert.name}`
            const bgColor = certColors[i % certColors.length]

            const row: (string | number)[] = [label, ""]

            for (const { dateStr } of yearDays) {
              let count = 0
              let hasWorkers = false

              for (const user of users) {
                const key = `${user.id}-${dateStr}`
                const schedule = scheduleMap.get(key)
                const isOnShift = shift === "DAY"
                  ? (schedule?.shiftType === "DAY" || schedule?.shiftType === "PL_DAY")
                  : (schedule?.shiftType === "NIGHT" || schedule?.shiftType === "PL_NIGHT")

                if (isOnShift) {
                  hasWorkers = true
                  const userCerts = userCertMap.get(user.id)
                  if (userCerts?.has(cert.id)) {
                    count++
                  }
                }
              }

              row.push(count > 0 ? count : (hasWorkers ? "!" : ""))
            }

            const excelRow = worksheet.addRow(row)
            excelRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } }
            excelRow.getCell(1).font = { bold: true, size: 10 }

            // Color cells based on requirement status
            let colIndex = 3
            for (const { dateStr } of yearDays) {
              let count = 0
              let hasWorkers = false

              for (const user of users) {
                const key = `${user.id}-${dateStr}`
                const schedule = scheduleMap.get(key)
                const isOnShift = shift === "DAY"
                  ? (schedule?.shiftType === "DAY" || schedule?.shiftType === "PL_DAY")
                  : (schedule?.shiftType === "NIGHT" || schedule?.shiftType === "PL_NIGHT")

                if (isOnShift) {
                  hasWorkers = true
                  const userCerts = userCertMap.get(user.id)
                  if (userCerts?.has(cert.id)) {
                    count++
                  }
                }
              }

              const cell = excelRow.getCell(colIndex)
              if (hasWorkers && count === 0 && cert.isRequired) {
                // Alert - red background (only for required certifications)
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "fecaca" } }
                cell.font = { color: { argb: "dc2626" }, bold: true }
              } else if (count >= 1) {
                // Met - green background
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "bbf7d0" } }
                cell.font = { color: { argb: "166534" } }
              }
              cell.alignment = { horizontal: "center" }
              colIndex++
            }
          }
        }
      }

      // Add total on duty row
      const totalRow: (string | number)[] = ["Total On Duty", ""]
      for (const { dateStr } of yearDays) {
        let count = 0
        for (const user of users) {
          const key = `${user.id}-${dateStr}`
          const schedule = scheduleMap.get(key)
          if (schedule && !["OFF", "O"].includes(schedule.shiftType)) {
            count++
          }
        }
        totalRow.push(count > 0 ? count : "")
      }
      const totalExcelRow = worksheet.addRow(totalRow)
      totalExcelRow.font = { bold: true }
      totalExcelRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "d1d5db" } }

      // Set column widths
      worksheet.getColumn(1).width = 20
      worksheet.getColumn(2).width = 15
      for (let i = 3; i <= yearDays.length + 2; i++) {
        worksheet.getColumn(i).width = 4
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="schedule-${year}.xlsx"`,
        },
      })
    }

    // CSV exports for other types
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

      const patterns = await prisma.rotationPattern.findMany({
        where: { organizationId: session.user.organizationId },
      })

      csv += "ROTATION PATTERNS\n"
      csv += "Name,Days On,Days Off,Includes Nights,Night Days,Alternates\n"
      for (const pattern of patterns) {
        csv += `"${sanitizeCSVValue(pattern.name)}","${sanitizeCSVValue(String(pattern.daysOn))}","${sanitizeCSVValue(String(pattern.daysOff))}","${sanitizeCSVValue(String(pattern.includesNights))}","${sanitizeCSVValue(String(pattern.nightDays))}","${sanitizeCSVValue(String(pattern.alternatesShifts))}"\n`
      }
    }

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
