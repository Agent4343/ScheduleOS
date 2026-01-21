import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params

    // Verify holiday belongs to organization
    const holiday = await prisma.holiday.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!holiday) {
      return NextResponse.json({ error: "Holiday not found" }, { status: 404 })
    }

    await prisma.holiday.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: "Holiday deleted" })
  } catch (error) {
    console.error("Error deleting holiday:", error)
    return NextResponse.json({ error: "Failed to delete holiday" }, { status: 500 })
  }
}
