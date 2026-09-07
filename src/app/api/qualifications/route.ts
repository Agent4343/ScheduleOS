import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"
import { qualificationSchema } from "@/lib/validations"

/** Sign-offs a worker can hold: Utilities Operator, Oil Operator, Control Room… */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const qualifications = await prisma.qualification.findMany({
      where: { organizationId: auth.session.user.organizationId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { requirements: true } } },
    })
    return apiOk(qualifications)
  } catch (error) {
    return handleRouteError(error, "Failed to load sign-offs")
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const body = await parseBody(qualificationSchema, request)
    const qualification = await prisma.qualification.create({
      data: { ...body, organizationId: auth.session.user.organizationId },
    })
    return apiOk(qualification, { status: 201, message: "Sign-off created" })
  } catch (error) {
    return handleRouteError(error, "Failed to create sign-off")
  }
}
