import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import * as XLSX from "xlsx"

interface WorkerRow {
  "Full Name": string
  "Email": string
  "Primary Position"?: string
  "Rotation Group"?: string
  "System Role"?: string
  "Phone"?: string
  "Hire Date"?: string | number
  "CCR Trained"?: string | boolean
  "PS Capable"?: string | boolean
  "PL Capable"?: string | boolean
}

function parseBoolean(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    return value.toLowerCase() === "yes" || value.toLowerCase() === "true" || value === "1"
  }
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
    const data = XLSX.utils.sheet_to_json<WorkerRow>(worksheet)

    if (data.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 })
    }

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
        // Validate required fields
        if (!row["Full Name"] || !row["Email"]) {
          results.errors.push({
            row: rowNum,
            email: row["Email"] || "unknown",
            error: "Full Name and Email are required",
          })
          continue
        }

        const email = row["Email"].toString().toLowerCase().trim()
        const name = row["Full Name"].toString().trim()

        // Find matching crew
        let crewId: string | null = null
        if (row["Rotation Group"]) {
          const crewName = row["Rotation Group"].toString().trim()
          const crew = crews.find(
            (c: { id: string; name: string }) => c.name.toLowerCase() === crewName.toLowerCase()
          )
          if (crew) crewId = crew.id
        }

        // Find matching position
        let position: string | null = null
        if (row["Primary Position"]) {
          position = row["Primary Position"].toString().trim()
        }

        // Parse role
        let role = "WORKER"
        if (row["System Role"]) {
          const roleStr = row["System Role"].toString().toUpperCase().trim()
          if (["ADMIN", "SUPERVISOR", "WORKER"].includes(roleStr)) {
            role = roleStr
          }
        }

        // Parse qualifications into JSON
        const qualifications = {
          ccrTrained: parseBoolean(row["CCR Trained"]),
          psCapable: parseBoolean(row["PS Capable"]),
          plCapable: parseBoolean(row["PL Capable"]),
        }

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
              phone: row["Phone"]?.toString() || null,
              hireDate: parseDate(row["Hire Date"]),
              metadata: qualifications,
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
              phone: row["Phone"]?.toString() || null,
              hireDate: parseDate(row["Hire Date"]),
              status: "ACTIVE",
              metadata: qualifications,
            },
          })
          results.created++
        }
      } catch (error) {
        results.errors.push({
          row: rowNum,
          email: row["Email"]?.toString() || "unknown",
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
