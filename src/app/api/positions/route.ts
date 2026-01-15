import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const positions = await prisma.position.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    return NextResponse.json({ success: true, data: positions })
  } catch (error) {
    console.error("Error fetching positions:", error)
    return NextResponse.json({ error: "Failed to fetch positions" }, { status: 500 })
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

    const position = await prisma.position.create({
      data: {
        name: body.name,
        code: body.code || null,
        category: body.category || null,
        shiftType: body.shiftType,
        minStaffing: body.minStaffing || 1,
        maxStaffing: body.maxStaffing || 1,
        requiredQualifications: body.requiredQualifications || [],
        sortOrder: body.sortOrder || 0,
        organizationId: session.user.organizationId,
      },
    })

    return NextResponse.json({ success: true, data: position }, { status: 201 })
  } catch (error) {
    console.error("Error creating position:", error)
    return NextResponse.json({ error: "Failed to create position" }, { status: 500 })
  }
}
