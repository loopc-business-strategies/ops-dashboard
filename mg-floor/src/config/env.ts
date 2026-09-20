import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra || {}) as {
  apiUrl?: string
  socketUrl?: string
  appEnv?: string
  tenant?: string
}

export const API_URL = String(extra.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000')
export const SOCKET_URL = String(extra.socketUrl || API_URL)
export const APP_ENV = String(extra.appEnv || 'development')
export const IS_PRODUCTION = APP_ENV === 'production'

if (IS_PRODUCTION && /localhost|127\.0\.0\.1|staging/i.test(API_URL)) {
  console.warn('[MG Floor] Production build points at non-production API — check EXPO_PUBLIC_API_URL')
}
