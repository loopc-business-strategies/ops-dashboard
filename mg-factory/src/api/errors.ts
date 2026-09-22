export type ApiErrorKind =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'AUTH_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'CANCELLED'
  | 'UNKNOWN_ERROR'
  | 'OFFLINE'

export class ApiError extends Error {
  kind: ApiErrorKind
  status: number | null

  constructor(message: string, kind: ApiErrorKind, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

export function classifyHttpStatus(status: number, message?: string): ApiError {
  const msg = message || `Request failed (${status})`
  if (status === 401) return new ApiError(msg, 'AUTH_ERROR', status)
  if (status === 403) return new ApiError(msg, 'FORBIDDEN', status)
  if (status === 404) return new ApiError(msg, 'NOT_FOUND', status)
  if (status === 400 || status === 409 || status === 422) {
    return new ApiError(msg, 'VALIDATION_ERROR', status)
  }
  if (status >= 500) return new ApiError(msg, 'SERVER_ERROR', status)
  return new ApiError(msg, 'UNKNOWN_ERROR', status)
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return new ApiError('Request timed out. Check connection.', 'TIMEOUT')
    }
    const msg = err.message || 'Unknown error'
    if (/network|failed to fetch|network request failed/i.test(msg)) {
      return new ApiError(msg, 'NETWORK_ERROR')
    }
    return new ApiError(msg, 'UNKNOWN_ERROR')
  }
  return new ApiError('Unknown error', 'UNKNOWN_ERROR')
}

export function userFacingMessage(err: unknown): string {
  const e = toApiError(err)
  if (e.kind === 'AUTH_ERROR') return 'Session expired. Sign in again.'
  if (e.kind === 'NETWORK_ERROR') return 'Network error. Check connection.'
  if (e.kind === 'TIMEOUT') return 'Request timed out. Check connection.'
  return e.message || 'Something went wrong.'
}
