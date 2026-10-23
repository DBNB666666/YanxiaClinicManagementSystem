export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DRUG_IN_USE'
  | 'STOCK_INSUFFICIENT'
  | 'DATA_DIR_UNWRITABLE'
  | 'DB_ERROR'
  | 'PRINT_FAILED'
  | 'EXPORT_FAILED'
  | 'UNKNOWN'

export interface AppErrorShape {
  code: ErrorCode
  message: string
  details?: unknown
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppErrorShape }

export class AppError extends Error {
  readonly code: ErrorCode
  readonly details?: unknown

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
}

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function fail(error: unknown): Result<never> {
  if (error instanceof AppError) {
    return { ok: false, error: { code: error.code, message: error.message, details: error.details } }
  }
  const message = error instanceof Error ? error.message : String(error)
  return { ok: false, error: { code: 'UNKNOWN', message } }
}
