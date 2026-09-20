import 'react-native-gesture-handler'

import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/src/context/AuthContext'
import { ErrorBoundary } from '@/src/components/ErrorBoundary'
import { startAutoSync } from '@/src/offline/sync'
import { LoadingBlock, Screen } from '@/src/components/ui'
import { API_CONFIG_ERROR } from '@/src/config/env'
import { colors } from '@/src/theme'

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash module may be unavailable in some native builds; ignore.
})

function ConfigErrorScreen({ message }: { message: string }) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {})
  }, [])

  return (
    <View style={styles.configWrap}>
      <Text style={styles.configBrand}>MG Floor</Text>
      <Text style={styles.configTitle}>Configuration error</Text>
      <Text style={styles.configBody}>{message}</Text>
      <Text style={styles.configMeta}>The app opened safely. Fix the build env and reinstall.</Text>
    </View>
  )
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, token } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    const onLogin = segments[0] === 'login'
    if (!token && !onLogin) router.replace('/login')
    if (token && onLogin) router.replace('/')
  }, [loading, token, segments, router])

  useEffect(() => {
    if (!token) return
    try {
      return startAutoSync()
    } catch {
      return undefined
    }
  }, [token])

  useEffect(() => {
    if (loading) return
    SplashScreen.hideAsync().catch(() => {})
  }, [loading])

  if (loading) {
    return (
      <Screen>
        <LoadingBlock label="Starting MG Floor…" />
      </Screen>
    )
  }

  return <>{children}</>
}

export default function RootLayout() {
  if (API_CONFIG_ERROR) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <StatusBar style="light" />
            <ConfigErrorScreen message={API_CONFIG_ERROR} />
          </ErrorBoundary>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    )
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AuthProvider>
            <StatusBar style="light" />
            <AuthGate>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.bg },
                  headerTintColor: colors.text,
                  contentStyle: { backgroundColor: colors.bg },
                  headerTitleStyle: { fontWeight: '800' },
                }}
              >
                <Stack.Screen name="index" options={{ title: 'MG FLOOR' }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="metal-in" options={{ title: 'METAL IN' }} />
                <Stack.Screen name="metal-out" options={{ title: 'METAL OUT' }} />
                <Stack.Screen name="transfer" options={{ title: 'TRANSFER' }} />
                <Stack.Screen name="scan" options={{ title: 'SCAN' }} />
                <Stack.Screen name="jobs" options={{ title: 'MY JOBS' }} />
                <Stack.Screen name="history" options={{ title: 'HISTORY' }} />
                <Stack.Screen name="scales" options={{ title: 'SCALES' }} />
                <Stack.Screen name="devices" options={{ title: 'DEVICES' }} />
                <Stack.Screen name="xrf" options={{ title: 'XRF / QC' }} />
                <Stack.Screen name="offline-sync" options={{ title: 'OFFLINE SYNC' }} />
                <Stack.Screen name="settings" options={{ title: 'SETTINGS' }} />
                <Stack.Screen name="profile" options={{ title: 'PROFILE' }} />
                <Stack.Screen name="correction" options={{ title: 'WEIGHT CORRECTION' }} />
              </Stack>
            </AuthGate>
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  configWrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  configBrand: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  configTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  configBody: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  configMeta: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
})
