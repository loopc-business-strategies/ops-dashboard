import type { ExpoConfig } from 'expo/config'

const { APP_NAME } = require('./appName.cjs')
const { EAS_PROJECT_ID } = require('./easProject.cjs')

/** Keep in sync with `version`. Bare workflow requires a string `runtimeVersion`, not `{ policy: ... }`. */
const APP_VERSION = '1.0.0'

/** Neutral native shell — tenant colors apply after JS loads via TenantContext. */
const NATIVE_SHELL_BACKGROUND = '#F8FAFC'
const NATIVE_SHELL_ACCENT = '#374151'

const PORTAL_HOSTS = ['mg.loopcstrategies.com', 'cg.loopcstrategies.com', 'loopc.loopcstrategies.com']

const PROD_API_URL = 'https://api.loopcstrategies.com'
const easProfile = process.env.EAS_BUILD_PROFILE || ''
const isProductionProfile = easProfile === 'production'
const apiUrlFromEnv = process.env.EXPO_PUBLIC_API_URL?.trim() || ''

if (!isProductionProfile && !apiUrlFromEnv) {
  throw new Error(
    `EXPO_PUBLIC_API_URL is required for non-production builds` +
      (easProfile ? ` (EAS profile "${easProfile}")` : ' (set it in .env or eas.json env)'),
  )
}

const apiUrl = apiUrlFromEnv || PROD_API_URL

const config: ExpoConfig = {
  name: APP_NAME,
  slug: 'nexa',
  version: APP_VERSION,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'nexaops',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.loopc.nexa',
    associatedDomains: PORTAL_HOSTS.map((host) => `applinks:${host}`),
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.loopc.nexa',
    adaptiveIcon: {
      backgroundColor: NATIVE_SHELL_BACKGROUND,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
    },
    intentFilters: PORTAL_HOSTS.map((host) => ({
      action: 'VIEW',
      autoVerify: true,
      category: ['BROWSABLE', 'DEFAULT'],
      data: [
        {
          scheme: 'https',
          host,
          pathPrefix: '/dashboard',
        },
      ],
    })),
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
        color: NATIVE_SHELL_ACCENT,
        defaultChannel: 'default',
      },
    ],
    'expo-secure-store',
    '@react-native-community/datetimepicker',
    '@sentry/react-native',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: NATIVE_SHELL_BACKGROUND,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  runtimeVersion: APP_VERSION,
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  extra: {
    tenant: 'loopc',
    apiUrl,
    easBuildProfile: easProfile || undefined,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || EAS_PROJECT_ID,
    },
  },
}

export default config
