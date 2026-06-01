import Constants from 'expo-constants'

export const TENANT = (Constants.expoConfig?.extra?.tenant as string) || 'mg'

export const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.loopcstrategies.com'
