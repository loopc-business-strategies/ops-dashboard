import type { ExpoConfig } from 'expo/config'

const APP_VERSION = '1.0.0'
const PROD_API_URL = 'https://api.loopcstrategies.com'
const easProfile = process.env.EAS_BUILD_PROFILE || ''
const isProductionProfile = easProfile === 'production'
const apiUrlFromEnv = process.env.EXPO_PUBLIC_API_URL?.trim() || process.env.MG_API_BASE_URL?.trim() || ''

const apiUrl = apiUrlFromEnv || (isProductionProfile ? PROD_API_URL : 'http://localhost:5000')

const config = {
  name: 'MG Factory',
  slug: 'mg-factory',
  version: APP_VERSION,
  orientation: 'landscape',
  icon: './assets/images/icon.png',
  scheme: 'mgfactory',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0F1419',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.loopc.mgfactory',
    requireFullScreen: true,
  },
  android: {
    package: 'com.loopc.mgfactory',
    permissions: ['INTERNET', 'USE_BIOMETRIC', 'USE_FINGERPRINT'],
    // sensorLandscape: either landscape direction on tablets
    screenOrientation: 'sensorLandscape',
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      backgroundColor: '#0F1419',
    },
  },
  web: {
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-splash-screen',
    'expo-secure-store',
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow MG Factory to use Face ID for employee sign-in.',
      },
    ],
  ],
  extra: {
    tenant: 'mg',
    apiUrl,
    appEnv: easProfile || process.env.MG_APP_ENV || 'development',
    eas: {
      projectId: process.env.EAS_PROJECT_ID || 'mg-factory-local',
    },
  },
} as ExpoConfig

export default config
