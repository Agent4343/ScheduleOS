import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import * as XLSX from "xlsx"

// Normalize column names to handle variations
function normalizeKey(key: string): string {
  return key.toLowerCase().trim().replace(/[^a-z0-9]/g, "")
}

// Get value from row with flexible key matching
function getValue(row: Record<string, unknown>, ...possibleKeys: string[]): unknown {
  const normalizedRow: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    normalizedRow[normalizeKey(key)] = value
  }

  for (const key of possibleKeys) {
    const normalizedKey = normalizeKey(key)
    if (normalizedRow[normalizedKey] !== undefined) {
      return normalizedRow[normalizedKey]
    }
  }
  return undefined
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim()
    return lower === "yes" || lower === "true" || lower === "1" || lower === "y"
  }
  if (typeof value === "number") return value === 1
  return false
}

function parseDate(value: string | number | undefined): Date | null {
  if (!value) return null

  // Excel serial date number
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30)
    return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000)
  }

  // Try parsing as string
  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })

    // Get first sheet
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

    if (data.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 })
    }

    // Log first row keys for debugging
    console.log("Excel columns found:", Object.keys(data[0] || {}))

    // Get existing crews for matching
    const crews = await prisma.crew.findMany({
      where: { organizationId: session.user.organizationId },
      select: { id: true, name: true },
    })

    const results = {
      created: 0,
      updated: 0,
      errors: [] as { row: number; email: string; error: string }[],
    }

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2 // Excel row (1-indexed + header)

      try {
        // Get values with flexible key matching
        const fullName = getValue(row, "Full Name", "Name", "FullName", "Worker Name", "Employee Name")
        const emailValue = getValue(row, "Email", "Email Address", "E-mail", "EmailAddress")

        // Validate required fields
        if (!fullName || !emailValue) {
          results.errors.push({
            row: rowNum,
            email: String(emailValue || "unknown"),
            error: `Full Name and Email are required. Found columns: ${Object.keys(row).join(", ")}`,
          })
          continue
        }

        const email = String(emailValue).toLowerCase().trim()
        const name = String(fullName).trim()

        // Find matching crew
        let crewId: string | null = null
        const rotationGroup = getValue(row, "Rotation Group", "Crew", "Group", "RotationGroup")
        if (rotationGroup) {
          const crewName = String(rotationGroup).trim()
          const crew = crews.find(
            (c: { id: string; name: string }) => c.name.toLowerCase() === crewName.toLowerCase()
          )
          if (crew) crewId = crew.id
        }

        // Find matching position
        let position: string | null = null
        const positionValue = getValue(row, "Primary Position", "Position", "PrimaryPosition", "Job Title")
        if (positionValue) {
          position = String(positionValue).trim()
        }

        // Parse role
        let role = "WORKER"
        const roleValue = getValue(row, "System Role", "Role", "SystemRole", "User Role")
        if (roleValue) {
          const roleStr = String(roleValue).toUpperCase().trim()
          if (["ADMIN", "SUPERVISOR", "WORKER"].includes(roleStr)) {
            role = roleStr
          }
        }

        // Parse qualifications
        const isCCRQualified = parseBoolean(getValue(row, "CCR Trained", "CCR", "CCRTrained", "CCR Qualified"))
        const isPSCapable = parseBoolean(getValue(row, "PS Capable", "PS", "PSCapable"))
        const isPLCapable = parseBoolean(getValue(row, "PL Capable", "PL", "PLCapable"))

        // Parse phone and hire date
        const phoneValue = getValue(row, "Phone", "Phone Number", "PhoneNumber", "Mobile")
        const hireDateValue = getValue(row, "Hire Date", "HireDate", "Start Date", "StartDate")

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
          where: {
            email,
            organizationId: session.user.organizationId,
          },
        })

        if (existingUser) {
          // Update existing user
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name,
              position,
              crewId,
              role: role as "ADMIN" | "SUPERVISOR" | "WORKER",
              phone: phoneValue ? String(phoneValue) : null,
              hireDate: parseDate(hireDateValue as string | number | undefined),
              isCCRQualified,
              isPSCapable,
              isPLCapable,
            },
          })
          results.updated++
        } else {
          // Create new user
          await prisma.user.create({
            data: {
              email,
              name,
              position,
              crewId,
              organizationId: session.user.organizationId,
              role: role as "ADMIN" | "SUPERVISOR" | "WORKER",
              phone: phoneValue ? String(phoneValue) : null,
              hireDate: parseDate(hireDateValue as string | number | undefined),
              status: "ACTIVE",
              isCCRQualified,
              isPSCapable,
              isPLCapable,
            },
          })
          results.created++
        }
      } catch (error) {
        results.errors.push({
          row: rowNum,
          email: String(getValue(row, "Email", "Email Address") || "unknown"),
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${data.length} rows: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`,
      data: results,
    })
  } catch (error) {
    console.error("Error uploading workers:", error)
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    )
  }
}

// GET endpoint to download template
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Create template workbook
    const templateData = [
      {
        "Full Name": "John Smith",
        "Email": "john.smith@example.com",
        "Primary Position": "Ops Tech",
        "Rotation Group": "Crew A",
        "System Role": "Worker",
        "Phone": "555-1234",
        "Hire Date": "2024-01-15",
        "CCR Trained": "No",
        "PS Capable": "No",
        "PL Capable": "No",
      },
      {
        "Full Name": "Jane Doe",
        "Email": "jane.doe@example.com",
        "Primary Position": "OCR Operator",
        "Rotation Group": "Crew B",
        "System Role": "Supervisor",
        "Phone": "555-5678",
        "Hire Date": "2023-06-01",
        "CCR Trained": "Yes",
        "PS Capable": "Yes",
        "PL Capable": "No",
      },
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(templateData)

    // Set column widths
    worksheet["!cols"] = [
      { wch: 20 }, // Full Name
      { wch: 30 }, // Email
      { wch: 20 }, // Primary Position
      { wch: 15 }, // Rotation Group
      { wch: 12 }, // System Role
      { wch: 15 }, // Phone
      { wch: 12 }, // Hire Date
      { wch: 12 }, // CCR Trained
      { wch: 12 }, // PS Capable
      { wch: 12 }, // PL Capable
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, "Workers")

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=worker_template.xlsx",
      },
    })
  } catch (error) {
    console.error("Error generating template:", error)
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    )
  }
}
