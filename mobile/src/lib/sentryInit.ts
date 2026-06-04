import * as Sentry from '@sentry/react-native'

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN

let initialized = false

/** Call once at app startup. No-op if DSN is unset. */
export function initMobileSentry() {
  if (initialized || !dsn) return
  initialized = true
  const release = String(process.env.EXPO_PUBLIC_SENTRY_RELEASE || '').trim()
  const tracesRaw = process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
  const tracesSampleRate = tracesRaw === undefined || tracesRaw === ''
    ? 0
    : Math.min(1, Math.max(0, Number(tracesRaw)))
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || (__DEV__ ? 'development' : 'production'),
    debug: __DEV__,
    ...(release ? { release } : {}),
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
  })
}
