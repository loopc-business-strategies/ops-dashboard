import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'MG Ops',
  slug: 'mg-ops-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'mgops',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.loopc.mg.ops',
  },
  android: {
    package: 'com.loopc.mg.ops',
    adaptiveIcon: {
      backgroundColor: '#005B96',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
    },
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
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
  extra: {
    tenant: 'mg',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.loopcstrategies.com',
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '',
    },
  },
}

export default config
