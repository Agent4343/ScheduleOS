import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const holidays = await prisma.holiday.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { date: "asc" },
    })

    return NextResponse.json({ success: true, data: holidays })
  } catch (error) {
    console.error("Error fetching holidays:", error)
    return NextResponse.json({ error: "Failed to fetch holidays" }, { status: 500 })
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

    if (!body.name || !body.date) {
      return NextResponse.json({ error: "Name and date are required" }, { status: 400 })
    }

    const holiday = await prisma.holiday.create({
      data: {
        name: body.name,
        date: new Date(body.date),
        recurring: body.recurring ?? true,
        organizationId: session.user.organizationId,
      },
    })

    return NextResponse.json({ success: true, data: holiday }, { status: 201 })
  } catch (error) {
    console.error("Error creating holiday:", error)
    return NextResponse.json({ error: "Failed to create holiday" }, { status: 500 })
  }
}
