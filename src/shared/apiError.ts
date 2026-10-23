import type { ErrorCode } from './result'

export function isApiErrorCode(cause: unknown, code: string): boolean {
  return Boolean(
    cause &&
      typeof cause === 'object' &&
      'code' in cause &&
      (cause as { code?: unknown }).code === code
  )
}

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly details?: unknown

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}
