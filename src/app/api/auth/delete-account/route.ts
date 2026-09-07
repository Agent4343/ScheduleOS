import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

export async function DELETE() {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

    // Check if user is the only admin in the organization
    if (session.user.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: {
          organizationId: session.user.organizationId,
          role: "ADMIN",
        },
      })

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the only admin account. Please assign another admin first." },
          { status: 400 }
        )
      }
    }

    // Schedules and invitations first: schedules are the bulk of the rows,
    // and an invitation this user sent would otherwise block the delete on a
    // foreign key and surface as an unexplained 500.
    await prisma.$transaction([
      prisma.schedule.deleteMany({ where: { userId: session.user.id } }),
      prisma.invitation.deleteMany({ where: { createdById: session.user.id } }),
      prisma.user.delete({ where: { id: session.user.id } }),
    ])

    return NextResponse.json({ success: true, message: "Account deleted successfully" })
  } catch (error) {
    console.error("Error deleting account:", error)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
