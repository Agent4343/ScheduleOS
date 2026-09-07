import { NextResponse } from "next/server"
import { ZodError, type ZodType } from "zod"
import { ServiceError } from "./services/errors"

/**
 * Small helpers so every route validates input and shapes responses the
 * same way. Success is `{ success: true, data, message? }`; failure is
 * `{ error, details? }` with a meaningful status.
 */

export function apiOk<T>(data: T, init?: { message?: string; status?: number }) {
  return NextResponse.json(
    { success: true, data, ...(init?.message && { message: init.message }) },
    { status: init?.status ?? 200 }
  )
}

export function apiError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details !== undefined && { details }) },
    { status }
  )
}

/** Parse and validate a JSON body. Throws ZodError (→ 400 via handleRouteError). */
export async function parseBody<T>(schema: ZodType<T>, request: Request): Promise<T> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    throw new ServiceError("Request body must be valid JSON", 400)
  }
  return schema.parse(json)
}

/**
 * Map thrown errors to responses. Use as the single catch in a route:
 *
 *   } catch (error) {
 *     return handleRouteError(error, "Failed to update crew")
 *   }
 */
export function handleRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) {
    return apiError("Invalid input data", 400, error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })))
  }
  if (error instanceof ServiceError) {
    return apiError(error.message, error.status)
  }
  console.error(fallbackMessage, error)
  return apiError(fallbackMessage, 500)
}
