/**
 * An error a service raises when the caller's request cannot be honoured.
 * Carries the HTTP status a route should answer with, so the REST layer and
 * the assistant can both surface it without re-deriving the reason.
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409 = 400
  ) {
    super(message)
    this.name = "ServiceError"
  }
}

export const notFound = (what: string) => new ServiceError(`${what} not found`, 404)
export const forbidden = (message: string) => new ServiceError(message, 403)
export const conflict = (message: string) => new ServiceError(message, 409)
