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

    // Fetch all user certifications for active users in the organization
    const userCertifications = await prisma.userCertification.findMany({
      where: {
        user: {
          organizationId: session.user.organizationId,
          status: "ACTIVE",
        },
      },
      select: {
        userId: true,
        certificationTypeId: true,
        expiresAt: true,
      },
    })

    return NextResponse.json({ success: true, data: userCertifications })
  } catch (error) {
    console.error("Error fetching user certifications:", error)
    return NextResponse.json({ error: "Failed to fetch user certifications" }, { status: 500 })
  }
}
