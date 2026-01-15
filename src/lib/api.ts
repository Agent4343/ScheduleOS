import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ZodError } from "zod"
import { authOptions } from "./auth"

// Response helpers
export function successResponse<T>(data: T, message?: string, status = 200) {
  return NextResponse.json(
    { success: true, data, ...(message && { message }) },
    { status }
  )
}

export function errorResponse(error: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { error, ...(details && { details }) },
    { status }
  )
}

export function createdResponse<T>(data: T, message?: string) {
  return successResponse(data, message, 201)
}

// Auth session type
export interface AuthSession {
  user: {
    id: string
    email: string
    name: string | null
    role: "ADMIN" | "SUPERVISOR" | "WORKER"
    organizationId: string
  }
}

// Handler types
type AuthHandler<T = unknown> = (session: AuthSession, context?: T) => Promise<NextResponse>
type HandlerOptions = {
  requiredRoles?: ("ADMIN" | "SUPERVISOR" | "WORKER")[]
}

// Wrapper for authenticated API routes
export function withAuth<T = unknown>(
  handler: AuthHandler<T>,
  options: HandlerOptions = {}
) {
  return async (context?: T): Promise<NextResponse> => {
    try {
      const session = await getServerSession(authOptions)

      if (!session?.user?.organizationId) {
        return errorResponse("Unauthorized", 401)
      }

      if (options.requiredRoles && !options.requiredRoles.includes(session.user.role)) {
        return errorResponse("Insufficient permissions", 403)
      }

      return await handler(session as AuthSession, context)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

// Centralized error handler
export function handleApiError(error: unknown, context?: string): NextResponse {
  console.error(context ? `${context}:` : "API Error:", error)

  if (error instanceof ZodError) {
    return errorResponse("Invalid input data", 400, error.errors)
  }

  return errorResponse(context ? `Failed to ${context}` : "Internal server error", 500)
}
