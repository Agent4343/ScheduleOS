/**
 * The one place the browser talks to /api.
 *
 * Every route answers `{ success: true, data, message? }` on success and
 * `{ error, details? }` on failure (see src/lib/api-helpers.ts). apiFetch
 * unwraps `data` and turns failures into a thrown ApiError, so callers never
 * inspect `res.ok` or `body.success` themselves.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

interface Envelope<T> {
  success?: boolean
  data?: T
  message?: string
  error?: string
  details?: unknown
}

export interface ApiResult<T> {
  data: T
  message?: string
}

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })

  let body: Envelope<T> = {}
  try {
    body = (await res.json()) as Envelope<T>
  } catch {
    // Non-JSON body (e.g. a 502 page). Fall through to the status check.
  }

  if (!res.ok || body.success === false || body.error) {
    throw new ApiError(res.status, body.error ?? res.statusText ?? "Request failed", body.details)
  }

  // Some routes return the payload without an envelope (e.g. assistant)
  return { data: (body.data !== undefined ? body.data : (body as unknown as T)), message: body.message }
}

/** GET and return the unwrapped `data`. */
export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  return (await request<T>(url, { ...init, method: "GET" })).data
}

/** POST/PATCH/PUT/DELETE with a JSON body; returns `{ data, message }`. */
export function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  url: string,
  body?: unknown
): Promise<ApiResult<T>> {
  return request<T>(url, { method, body: body === undefined ? undefined : JSON.stringify(body) })
}

/** Build a query string, skipping undefined/empty values. */
export function qs(params: object): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v))
  }
  const s = search.toString()
  return s ? `?${s}` : ""
}

/** A readable message for any thrown value. */
export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
