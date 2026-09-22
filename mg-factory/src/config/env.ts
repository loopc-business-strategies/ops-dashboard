import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra || {}) as {
  apiUrl?: string
  appEnv?: string
  tenant?: string
}

export const API_URL = String(extra.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000').trim()
export const APP_ENV = String(extra.appEnv || 'development')
export const IS_PRODUCTION = APP_ENV === 'production' || /api\.loopcstrategies\.com/i.test(API_URL)

function isValidHttpUrl(value: string) {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export const API_CONFIG_ERROR = (() => {
  if (!API_URL || !isValidHttpUrl(API_URL)) {
    return 'MG Factory API URL is missing or invalid. Rebuild with EXPO_PUBLIC_API_URL set.'
  }
  if (IS_PRODUCTION && /localhost|127\.0\.0\.1/i.test(API_URL)) {
    return 'This production build still points at localhost. Rebuild with EXPO_PUBLIC_API_URL=https://api.loopcstrategies.com'
  }
  return null as string | null
})()
