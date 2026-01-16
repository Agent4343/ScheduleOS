import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

// Default shift types to seed for new organizations
const DEFAULT_SHIFT_TYPES = [
  // Working - Field Operations
  { code: "DAY", name: "Day Shift", abbreviation: "D", category: "Working", bgColor: "bg-green-500", textColor: "text-white", sortOrder: 1, isSystem: true },
  { code: "NIGHT", name: "Night Shift", abbreviation: "N", category: "Working", bgColor: "bg-blue-600", textColor: "text-white", sortOrder: 2, isSystem: true },

  // Working - Control Room
  { code: "OCR_DAY", name: "OCR Day", abbreviation: "OR", category: "Working", bgColor: "bg-teal-500", textColor: "text-white", sortOrder: 3, isSystem: true },
  { code: "OCR_NIGHT", name: "OCR Night", abbreviation: "OR", category: "Working", bgColor: "bg-indigo-600", textColor: "text-white", sortOrder: 4, isSystem: true },
  { code: "CCR_DAY", name: "CCR Day", abbreviation: "CR", category: "Working", bgColor: "bg-cyan-500", textColor: "text-white", sortOrder: 5, isSystem: true },
  { code: "CCR_NIGHT", name: "CCR Night", abbreviation: "CR", category: "Working", bgColor: "bg-purple-600", textColor: "text-white", sortOrder: 6, isSystem: true },

  // Working - Backfill
  { code: "PS", name: "Production Supervisor", abbreviation: "PS", category: "Working", bgColor: "bg-amber-500", textColor: "text-white", sortOrder: 7, isSystem: true },
  { code: "PL_DAY", name: "Production Lead Day", abbreviation: "PL", category: "Working", bgColor: "bg-orange-400", textColor: "text-white", sortOrder: 8, isSystem: true },
  { code: "PL_NIGHT", name: "Production Lead Night", abbreviation: "PL", category: "Working", bgColor: "bg-orange-600", textColor: "text-white", sortOrder: 9, isSystem: true },

  // Other
  { code: "TRAINING", name: "Training", abbreviation: "TR", category: "Other", bgColor: "bg-yellow-300", textColor: "text-yellow-900", sortOrder: 20, isSystem: true },
  { code: "OSCC", name: "OSCC", abbreviation: "OS", category: "Other", bgColor: "bg-yellow-500", textColor: "text-white", sortOrder: 21, isSystem: true },

  // Absence
  { code: "VACATION", name: "Vacation", abbreviation: "V", category: "Absence", bgColor: "bg-emerald-400", textColor: "text-emerald-900", sortOrder: 30, isSystem: true },
  { code: "SICK", name: "Sick Leave", abbreviation: "SL", category: "Absence", bgColor: "bg-red-400", textColor: "text-red-900", sortOrder: 31, isSystem: true },
  { code: "LEAVE", name: "Leave", abbreviation: "L", category: "Absence", bgColor: "bg-gray-400", textColor: "text-white", sortOrder: 32, isSystem: true },

  // Other status
  { code: "SHUTDOWN", name: "Shutdown", abbreviation: "X", category: "Other", bgColor: "bg-slate-500", textColor: "text-white", sortOrder: 40, isSystem: true },
]

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId

    // Get shift types for this organization
    let shiftTypes = await prisma.shiftTypeConfig.findMany({
      where: { organizationId },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    })

    // If no shift types exist, seed the defaults
    if (shiftTypes.length === 0) {
      await prisma.shiftTypeConfig.createMany({
        data: DEFAULT_SHIFT_TYPES.map((st) => ({
          ...st,
          organizationId,
        })),
      })

      shiftTypes = await prisma.shiftTypeConfig.findMany({
        where: { organizationId },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      })
    }

    return NextResponse.json({ success: true, data: shiftTypes })
  } catch (error) {
    console.error("Error fetching shift types:", error)
    return NextResponse.json({ error: "Failed to fetch shift types" }, { status: 500 })
  }
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

    const body = await request.json()
    const { code, name, abbreviation, category, bgColor, textColor, sortOrder } = body

    if (!code || !name || !abbreviation || !category) {
      return NextResponse.json(
        { error: "Code, name, abbreviation, and category are required" },
        { status: 400 }
      )
    }

    // Check if code already exists
    const existing = await prisma.shiftTypeConfig.findUnique({
      where: {
        organizationId_code: {
          organizationId: session.user.organizationId,
          code: code.toUpperCase(),
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "A shift type with this code already exists" },
        { status: 400 }
      )
    }

    const shiftType = await prisma.shiftTypeConfig.create({
      data: {
        organizationId: session.user.organizationId,
        code: code.toUpperCase(),
        name,
        abbreviation,
        category,
        bgColor: bgColor || "bg-gray-500",
        textColor: textColor || "text-white",
        sortOrder: sortOrder || 50,
        isSystem: false,
        isActive: true,
      },
    })

    return NextResponse.json(
      { success: true, data: shiftType, message: "Shift type created" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating shift type:", error)
    return NextResponse.json({ error: "Failed to create shift type" }, { status: 500 })
  }
}
