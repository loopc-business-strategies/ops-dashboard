import type { ExpoConfig } from 'expo/config'
import { mgBranding } from './src/config/branding'

/** Keep in sync with `version`. Bare workflow requires a string `runtimeVersion`, not `{ policy: ... }`. */
const APP_VERSION = '1.0.0'

const config: ExpoConfig = {
  name: mgBranding.appName,
  slug: 'mg-ops-mobile',
  version: APP_VERSION,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'mgops',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.loopc.mg.ops',
    associatedDomains: ['applinks:mg.loopcstrategies.com'],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.loopc.mg.ops',
    adaptiveIcon: {
      backgroundColor: '#005B96',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: [
          {
            scheme: 'https',
            host: 'mg.loopcstrategies.com',
            pathPrefix: '/dashboard',
          },
        ],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
        color: '#005B96',
        defaultChannel: 'default',
      },
    ],
    'expo-secure-store',
    '@sentry/react-native',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#005B96',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  /** Required for bare / prebuild (`android/` in repo). Bump when shipping incompatible native or OTA changes. */
  runtimeVersion: APP_VERSION,
  updates: {
    url: 'https://u.expo.dev/3fe355ea-49d0-480f-a0c1-33432daa0e63',
  },
  extra: {
    tenant: 'mg',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.loopcstrategies.com',
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '3fe355ea-49d0-480f-a0c1-33432daa0e63',
    },
  },
}

export default config
