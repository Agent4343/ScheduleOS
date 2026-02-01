import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

// GDPR Article 20 - Right to data portability
// Export all personal data associated with the user in JSON format
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all user data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        position: true,
        positionType: true,
        role: true,
        status: true,
        hireDate: true,
        createdAt: true,
        updatedAt: true,
        crew: {
          select: {
            name: true,
          },
        },
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Fetch user's schedules
    const schedules = await prisma.schedule.findMany({
      where: { userId: session.user.id },
      select: {
        date: true,
        shiftType: true,
        customShiftCode: true,
        isOverride: true,
        overrideReason: true,
        notes: true,
        createdAt: true,
      },
      orderBy: { date: "desc" },
    })

    // Fetch user's time-off requests
    const timeOffRequests = await prisma.timeOffRequest.findMany({
      where: { userId: session.user.id },
      select: {
        startDate: true,
        endDate: true,
        type: true,
        status: true,
        reason: true,
        notes: true,
        createdAt: true,
        approvedAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    // Fetch user's notifications
    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      select: {
        type: true,
        title: true,
        message: true,
        read: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    // Fetch user's holiday tracking
    const holidayTracking = await prisma.holidayTracking.findMany({
      where: { userId: session.user.id },
      select: {
        year: true,
        worked: true,
        holiday: {
          select: {
            name: true,
            date: true,
          },
        },
      },
    })

    // Fetch user's AI chat sessions
    const aiChatSessions = await prisma.aIChatSession.findMany({
      where: { userId: session.user.id },
      select: {
        title: true,
        createdAt: true,
        messages: {
          select: {
            role: true,
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Compile all data
    const exportData = {
      exportDate: new Date().toISOString(),
      exportType: "GDPR Personal Data Export",
      user: {
        profile: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          position: user.position,
          positionType: user.positionType,
          role: user.role,
          status: user.status,
          hireDate: user.hireDate,
          accountCreated: user.createdAt,
          lastUpdated: user.updatedAt,
        },
        organization: user.organization,
        crew: user.crew,
      },
      schedules: schedules.map((s: typeof schedules[number]) => ({
        ...s,
        date: s.date.toISOString().split("T")[0],
      })),
      timeOffRequests: timeOffRequests.map((t: typeof timeOffRequests[number]) => ({
        ...t,
        startDate: t.startDate.toISOString().split("T")[0],
        endDate: t.endDate.toISOString().split("T")[0],
      })),
      notifications,
      holidayTracking,
      aiConversations: aiChatSessions,
    }

    // Return as JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="my-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    console.error("Error exporting personal data:", error)
    return NextResponse.json(
      { error: "Failed to export personal data" },
      { status: 500 }
    )
  }
}
