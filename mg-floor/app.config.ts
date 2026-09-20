import type { ExpoConfig } from 'expo/config'

const APP_VERSION = '1.0.0'
const PROD_API_URL = 'https://api.loopcstrategies.com'
const easProfile = process.env.EAS_BUILD_PROFILE || ''
const isProductionProfile = easProfile === 'production'
const apiUrlFromEnv = process.env.EXPO_PUBLIC_API_URL?.trim() || process.env.MG_API_BASE_URL?.trim() || ''

if (!isProductionProfile && !apiUrlFromEnv) {
  // Allow local typecheck without env; runtime start should set EXPO_PUBLIC_API_URL
}

const apiUrl = apiUrlFromEnv || (isProductionProfile ? PROD_API_URL : 'http://localhost:5000')

const config = {
  name: 'MG Floor',
  slug: 'mg-floor',
  version: APP_VERSION,
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'mgfloor',
  userInterfaceStyle: 'light',
  // RN 0.85 + Reanimated 4 require New Architecture (false is ignored / unsupported).
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0F1419',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.loopc.mgfloor',
  },
  android: {
    package: 'com.loopc.mgfloor',
    permissions: ['CAMERA', 'INTERNET'],
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
    [
      'expo-camera',
      {
        cameraPermission: 'Allow MG Floor to scan job and batch barcodes.',
      },
    ],
    'expo-secure-store',
  ],
  extra: {
    tenant: 'mg',
    apiUrl,
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || apiUrl,
    appEnv: easProfile || process.env.MG_APP_ENV || 'development',
    eas: {
      projectId: process.env.EAS_PROJECT_ID || 'mg-floor-local',
    },
  },
} as ExpoConfig

export default config
