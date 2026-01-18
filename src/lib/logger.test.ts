import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, createApiError, API_ERRORS } from './logger'

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('debug', () => {
    it('logs debug messages', () => {
      logger.debug('Test debug message')
      expect(console.debug).toHaveBeenCalled()
    })

    it('includes context in debug logs', () => {
      logger.debug('Test message', { userId: '123', action: 'test' })
      expect(console.debug).toHaveBeenCalled()
    })
  })

  describe('info', () => {
    it('logs info messages', () => {
      logger.info('Test info message')
      expect(console.info).toHaveBeenCalled()
    })

    it('includes context in info logs', () => {
      logger.info('User logged in', { userId: '123' })
      expect(console.info).toHaveBeenCalled()
    })
  })

  describe('warn', () => {
    it('logs warning messages', () => {
      logger.warn('Test warning message')
      expect(console.warn).toHaveBeenCalled()
    })

    it('includes context in warning logs', () => {
      logger.warn('Deprecated API used', { endpoint: '/old-api' })
      expect(console.warn).toHaveBeenCalled()
    })
  })

  describe('error', () => {
    it('logs error messages', () => {
      logger.error('Test error message')
      expect(console.error).toHaveBeenCalled()
    })

    it('logs error with Error object', () => {
      const error = new Error('Something went wrong')
      logger.error('Operation failed', error)
      expect(console.error).toHaveBeenCalled()
    })

    it('logs error with context', () => {
      logger.error('Database error', undefined, { query: 'SELECT *' })
      expect(console.error).toHaveBeenCalled()
    })

    it('logs error with both Error and context', () => {
      const error = new Error('Connection timeout')
      logger.error('Database connection failed', error, { host: 'localhost' })
      expect(console.error).toHaveBeenCalled()
    })

    it('handles non-Error objects gracefully', () => {
      logger.error('Unexpected error', 'string error')
      expect(console.error).toHaveBeenCalled()
    })

    it('handles undefined error gracefully', () => {
      logger.error('Error with no details')
      expect(console.error).toHaveBeenCalled()
    })
  })
})

describe('createApiError', () => {
  it('creates error with default status 500', () => {
    const error = createApiError('Something went wrong')
    expect(error).toEqual({
      error: 'Something went wrong',
      status: 500,
    })
  })

  it('creates error with custom status code', () => {
    const error = createApiError('Not found', 404)
    expect(error).toEqual({
      error: 'Not found',
      status: 404,
    })
  })

  it('creates error with 400 status', () => {
    const error = createApiError('Bad request', 400)
    expect(error.status).toBe(400)
  })

  it('creates error with 401 status', () => {
    const error = createApiError('Unauthorized', 401)
    expect(error.status).toBe(401)
  })

  it('creates error with 403 status', () => {
    const error = createApiError('Forbidden', 403)
    expect(error.status).toBe(403)
  })
})

describe('API_ERRORS', () => {
  it('has UNAUTHORIZED error', () => {
    expect(API_ERRORS.UNAUTHORIZED).toEqual({
      error: 'Unauthorized',
      status: 401,
    })
  })

  it('has FORBIDDEN error', () => {
    expect(API_ERRORS.FORBIDDEN).toEqual({
      error: 'Forbidden',
      status: 403,
    })
  })

  it('has NOT_FOUND error', () => {
    expect(API_ERRORS.NOT_FOUND).toEqual({
      error: 'Not found',
      status: 404,
    })
  })

  it('has VALIDATION_ERROR error', () => {
    expect(API_ERRORS.VALIDATION_ERROR).toEqual({
      error: 'Invalid input data',
      status: 400,
    })
  })

  it('has INTERNAL_ERROR error', () => {
    expect(API_ERRORS.INTERNAL_ERROR).toEqual({
      error: 'Internal server error',
      status: 500,
    })
  })

  it('has CONFLICT error', () => {
    expect(API_ERRORS.CONFLICT).toEqual({
      error: 'Resource already exists',
      status: 409,
    })
  })

  it('does not expose internal details', () => {
    // Ensure no API error contains sensitive information
    Object.values(API_ERRORS).forEach(error => {
      expect(error.error).not.toContain('stack')
      expect(error.error).not.toContain('database')
      expect(error.error).not.toContain('prisma')
      expect(error.error).not.toContain('sql')
    })
  })
})
