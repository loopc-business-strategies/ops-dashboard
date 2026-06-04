import * as Sentry from '@sentry/react-native'

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN

let initialized = false

/** Call once at app startup. No-op if DSN is unset. */
export function initMobileSentry() {
  if (initialized || !dsn) return
  initialized = true
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || (__DEV__ ? 'development' : 'production'),
    debug: __DEV__,
  })
}
