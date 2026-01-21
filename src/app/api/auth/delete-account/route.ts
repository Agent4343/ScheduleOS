import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    // Delete user's schedules
    await prisma.schedule.deleteMany({
      where: { userId: session.user.id },
    })

    // Delete user
    await prisma.user.delete({
      where: { id: session.user.id },
    })

    return NextResponse.json({ success: true, message: "Account deleted successfully" })
  } catch (error) {
    console.error("Error deleting account:", error)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
