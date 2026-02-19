import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

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
