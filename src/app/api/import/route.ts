import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

interface CSVWorkerRow {
  name: string
  email: string
  position?: string
  positionType?: string
  phone?: string
  crew?: string
  role?: string
}

function parseCSV(text: string): CSVWorkerRow[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""))
  const rows: CSVWorkerRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/^["']|["']$/g, ""))
    if (values.length < 2) continue

    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || ""
    })

    if (row.name && row.email) {
      rows.push({
        name: row.name,
        email: row.email,
        position: row.position || row.title || undefined,
        positionType: row.positiontype || row["position type"] || row["position_type"] || undefined,
        phone: row.phone || row.mobile || undefined,
        crew: row.crew || row.team || row.group || undefined,
        role: row.role || undefined,
      })
    }
  }

  return rows
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const { session } = auth

    const contentType = request.headers.get("content-type") || ""

    let rows: CSVWorkerRow[]

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file") as File
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }
      const text = await file.text()
      rows = parseCSV(text)
    } else {
      const body = await request.json()
      if (body.csv) {
        rows = parseCSV(body.csv)
      } else if (Array.isArray(body.workers)) {
        rows = body.workers
      } else {
        return NextResponse.json({ error: "Provide a CSV file or JSON array of workers" }, { status: 400 })
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid worker rows found. CSV must have 'name' and 'email' columns." }, { status: 400 })
    }

    if (rows.length > 500) {
      return NextResponse.json({ error: "Maximum 500 workers per import" }, { status: 400 })
    }

    // Get existing crews for matching
    const crews = await prisma.crew.findMany({
      where: { organizationId: session.user.organizationId },
      select: { id: true, name: true },
    })
    const crewMap = new Map(crews.map(c => [c.name.toLowerCase(), c.id]))

    // Get existing emails to skip duplicates
    const existingEmails = new Set(
      (await prisma.user.findMany({
        where: { organizationId: session.user.organizationId },
        select: { email: true },
      })).map(u => u.email.toLowerCase())
    )

    const results = { created: 0, skipped: 0, errors: [] as string[] }

    for (const row of rows) {
      try {
        if (existingEmails.has(row.email.toLowerCase())) {
          results.skipped++
          continue
        }

        const validRoles = ["ADMIN", "SUPERVISOR", "WORKER"]
        const role = row.role && validRoles.includes(row.role.toUpperCase())
          ? row.role.toUpperCase() as "ADMIN" | "SUPERVISOR" | "WORKER"
          : "WORKER"

        const validPositionTypes = ["OPERATOR", "ONSHORE_CONTROL_ROOM", "OTHER"]
        const positionType = row.positionType && validPositionTypes.includes(row.positionType.toUpperCase())
          ? row.positionType.toUpperCase() as "OPERATOR" | "ONSHORE_CONTROL_ROOM" | "OTHER"
          : "OTHER"

        const crewId = row.crew ? crewMap.get(row.crew.toLowerCase()) || null : null

        await prisma.user.create({
          data: {
            name: row.name,
            email: row.email.toLowerCase(),
            position: row.position || null,
            positionType,
            phone: row.phone || null,
            role,
            crewId,
            organizationId: session.user.organizationId,
            status: "ACTIVE",
          },
        })

        existingEmails.add(row.email.toLowerCase())
        results.created++
      } catch {
        results.errors.push(`Failed to import: ${row.email}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `Imported ${results.created} worker(s), skipped ${results.skipped} duplicate(s)${results.errors.length > 0 ? `, ${results.errors.length} error(s)` : ""}`,
    })
  } catch (error) {
    console.error("Error importing workers:", error)
    return NextResponse.json({ error: "Failed to import workers" }, { status: 500 })
  }
}
