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
  cancelled: boolean

  constructor(message: string, kind: ApiErrorKind, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.cancelled = kind === 'CANCELLED'
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

export function toApiError(err: unknown, cancelled = false): ApiError {
  if (cancelled) return new ApiError('Request cancelled', 'CANCELLED')
  if (err instanceof ApiError) return err
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return new ApiError('Request timed out. Check connection or work offline.', 'TIMEOUT')
    }
    const msg = err.message || 'Unknown error'
    if (/network|failed to fetch|network request failed/i.test(msg)) {
      return new ApiError(msg, 'NETWORK_ERROR')
    }
    if (/timed? ?out/i.test(msg)) {
      return new ApiError(msg, 'TIMEOUT')
    }
    return new ApiError(msg, 'UNKNOWN_ERROR')
  }
  return new ApiError('Unknown error', 'UNKNOWN_ERROR')
}

export function userFacingMessage(err: unknown): string {
  const e = toApiError(err)
  switch (e.kind) {
    case 'TIMEOUT':
      return 'Request timed out. Check connection or work offline.'
    case 'NETWORK_ERROR':
      return 'Network error. Check connection.'
    case 'OFFLINE':
      return 'You are offline.'
    case 'AUTH_ERROR':
      return 'Session expired. Sign in again.'
    case 'FORBIDDEN':
      return e.message || 'Not allowed.'
    case 'NOT_FOUND':
      return e.message || 'Not found.'
    case 'VALIDATION_ERROR':
      return e.message
    case 'SERVER_ERROR':
      return e.message || 'Server error. Try again.'
    case 'CANCELLED':
      return ''
    default:
      return e.message || 'Something went wrong.'
  }
}
