import 'react-native-gesture-handler'

import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/src/context/AuthContext'
import { ErrorBoundary } from '@/src/components/ErrorBoundary'
import { AppChrome } from '@/src/navigation/AppChrome'
import { AuthHeaderActions } from '@/src/navigation/AuthHeaderActions'
import { startAutoSync } from '@/src/offline/sync'
import { BigButton, LoadingBlock, Screen } from '@/src/components/ui'
import { getSelectedDepartment } from '@/src/auth/sessionPrefs'
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
  const { loading, token, hydrateError, retryHydrate } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const [deptReady, setDeptReady] = useState(false)
  const [hasDepartment, setHasDepartment] = useState(false)

  useEffect(() => {
    if (loading) return
    let cancelled = false
    ;(async () => {
      const dept = await getSelectedDepartment()
      if (cancelled) return
      const hasDept = Boolean(dept)
      setHasDepartment(hasDept)
      setDeptReady(true)

      const seg0 = segments[0]
      const onDepartment = seg0 === 'department'
      const onLogin = seg0 === 'login'

      if (!hasDept && !onDepartment) {
        router.replace('/department')
        return
      }
      if (token && onLogin) {
        router.replace('/')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loading, segments, token, router])

  useEffect(() => {
    if (!token) return
    try {
      return startAutoSync()
    } catch {
      return undefined
    }
  }, [token])

  useEffect(() => {
    if (loading || !deptReady) return
    SplashScreen.hideAsync().catch(() => {})
  }, [loading, deptReady])

  if (loading || !deptReady) {
    return (
      <Screen>
        <LoadingBlock label="Starting MG Floor…" />
      </Screen>
    )
  }

  if (hydrateError && !token) {
    return (
      <Screen>
        <Text style={styles.configTitle}>Unable to restore session</Text>
        <Text style={styles.configBody}>{hydrateError}</Text>
        <BigButton label="RETRY" onPress={() => retryHydrate()} />
        <BigButton label="SIGN IN" onPress={() => router.replace('/login')} tone="neutral" />
        {hasDepartment ? (
          <BigButton label="CONTINUE WITHOUT SIGN-IN" onPress={() => router.replace('/')} tone="neutral" />
        ) : null}
      </Screen>
    )
  }

  const seg0 = segments[0]
  const onAuthScreen = seg0 === 'login' || seg0 === 'department'
  if (onAuthScreen || !hasDepartment) {
    return <>{children}</>
  }

  return <AppChrome>{children}</AppChrome>
}

export default function RootLayout() {
  if (API_CONFIG_ERROR) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <StatusBar style="dark" />
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
            <StatusBar style="dark" />
            <AuthGate>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.text,
                  contentStyle: { backgroundColor: colors.bg },
                  headerTitleStyle: { fontWeight: '800' },
                  headerRight: () => <AuthHeaderActions />,
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="department" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="metal-in" options={{ title: 'METAL IN' }} />
                <Stack.Screen name="metal-out" options={{ title: 'METAL OUT' }} />
                <Stack.Screen name="transfer" options={{ title: 'TRANSFER' }} />
                <Stack.Screen name="scales" options={{ title: 'SCALES' }} />
                <Stack.Screen name="devices" options={{ title: 'DEVICES' }} />
                <Stack.Screen name="xrf" options={{ title: 'XRF / QC' }} />
                <Stack.Screen name="offline-sync" options={{ title: 'OFFLINE SYNC' }} />
                <Stack.Screen name="settings" options={{ title: 'SETTINGS' }} />
                <Stack.Screen name="profile" options={{ title: 'PROFILE' }} />
                <Stack.Screen name="correction" options={{ title: 'WEIGHT CORRECTION' }} />
                <Stack.Screen name="batches" options={{ title: 'BATCHES' }} />
                <Stack.Screen name="reports" options={{ title: 'REPORTS' }} />
                <Stack.Screen name="call-manager" options={{ title: 'CALL MANAGER' }} />
                <Stack.Screen name="production" options={{ title: 'PRODUCTION' }} />
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
