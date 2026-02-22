import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

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
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

    const body = await request.json()

    if (!body.name || !body.date) {
      return NextResponse.json({ error: "Name and date are required" }, { status: 400 })
    }

    const holiday = await prisma.holiday.create({
      data: {
        name: body.name,
        date: new Date(body.date),
        isRecurring: body.recurring ?? true,
        organizationId: session.user.organizationId,
      },
    })

    return NextResponse.json({ success: true, data: holiday }, { status: 201 })
  } catch (error) {
    console.error("Error creating holiday:", error)
    return NextResponse.json({ error: "Failed to create holiday" }, { status: 500 })
  }
}
