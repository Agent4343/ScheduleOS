type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// In production, only log warn and above. In dev/test, log everything.
const MIN_LOG_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL]
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (easier to parse in log aggregators)
    return JSON.stringify(entry)
  }
  // Human-readable format for development
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
  return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}`
}

function createLogEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  }
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      console.debug(formatLog(createLogEntry('debug', message, context)))
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      console.info(formatLog(createLogEntry('info', message, context)))
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
      console.warn(formatLog(createLogEntry('warn', message, context)))
    }
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (shouldLog('error')) {
      const errorContext: LogContext = { ...context }

      if (error instanceof Error) {
        errorContext.errorName = error.name
        errorContext.errorMessage = error.message
        // Only include stack in non-production
        if (process.env.NODE_ENV !== 'production') {
          errorContext.stack = error.stack
        }
      } else if (error !== undefined) {
        errorContext.error = String(error)
      }

      console.error(formatLog(createLogEntry('error', message, errorContext)))
    }
  },
}

// API error response helper - never exposes internal details
export function createApiError(
  message: string,
  statusCode: number = 500
): { error: string; status: number } {
  return {
    error: message,
    status: statusCode,
  }
}

// Standard API error messages (don't leak implementation details)
export const API_ERRORS = {
  UNAUTHORIZED: createApiError('Unauthorized', 401),
  FORBIDDEN: createApiError('Forbidden', 403),
  NOT_FOUND: createApiError('Not found', 404),
  VALIDATION_ERROR: createApiError('Invalid input data', 400),
  INTERNAL_ERROR: createApiError('Internal server error', 500),
  CONFLICT: createApiError('Resource already exists', 409),
} as const
