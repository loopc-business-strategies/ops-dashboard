import type { ExpoConfig } from 'expo/config'

const APP_VERSION = '1.1.0'
const PROD_API_URL = 'https://api.loopcstrategies.com'
const easProfile = process.env.EAS_BUILD_PROFILE || ''
const isProductionProfile = easProfile === 'production'
const isLocalDev =
  process.env.MG_APP_ENV === 'development' ||
  (!isProductionProfile &&
    easProfile !== 'preview' &&
    process.env.NODE_ENV !== 'production' &&
    !process.env.GRADLE_TASK?.toLowerCase().includes('release'))

const apiUrlFromEnv = process.env.EXPO_PUBLIC_API_URL?.trim() || process.env.MG_API_BASE_URL?.trim() || ''

/** Unset env → prod HTTPS for release/device APKs (avoids cleartext localhost). Local metro: set MG_APP_ENV=development. */
const apiUrl = apiUrlFromEnv || (isLocalDev ? 'http://localhost:5000' : PROD_API_URL)

const usesCleartextTraffic = /^http:\/\//i.test(apiUrl)

const config = {
  name: 'MG Floor',
  slug: 'mg-floor',
  version: APP_VERSION,
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'mgfloor',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/branding/modern-gold-logo.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.loopc.mgfloor',
    infoPlist: usesCleartextTraffic
      ? {
          NSAppTransportSecurity: {
            NSAllowsArbitraryLoads: true,
          },
        }
      : undefined,
  },
  android: {
    package: 'com.loopc.mgfloor',
    permissions: ['CAMERA', 'INTERNET', 'USE_BIOMETRIC', 'USE_FINGERPRINT'],
    usesCleartextTraffic,
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundColor: '#FFFFFF',
    },
  },
  web: {
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-splash-screen',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow MG Floor to scan job and batch barcodes.',
      },
    ],
    'expo-secure-store',
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow MG Floor to use Face ID for employee sign-in.',
      },
    ],
  ],
  extra: {
    tenant: 'mg',
    apiUrl,
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || apiUrl,
    appEnv: easProfile || process.env.MG_APP_ENV || (isLocalDev ? 'development' : 'production'),
    eas: {
      projectId: process.env.EAS_PROJECT_ID || 'mg-floor-local',
    },
  },
} as ExpoConfig

export default config
