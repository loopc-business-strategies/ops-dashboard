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
import { LoadingBlock, Screen } from '@/src/components/ui'
import { API_CONFIG_ERROR } from '@/src/config/env'
import { useLockOrientation } from '@/src/hooks/useLockOrientation'
import { colors } from '@/src/theme'

SplashScreen.preventAutoHideAsync().catch(() => {})

function ConfigErrorScreen({ message }: { message: string }) {
  useLockOrientation(true)

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {})
  }, [])

  return (
    <View style={styles.configWrap}>
      <Text style={styles.configBrand}>MG Factory</Text>
      <Text style={styles.configTitle}>Configuration error</Text>
      <Text style={styles.configBody}>{message}</Text>
    </View>
  )
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, departmentToken } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  useLockOrientation(!loading)

  useEffect(() => {
    if (loading) return
    const route = String(segments[0] || '')
    const onDept = route === 'department-login'

    if (!departmentToken && !onDept) {
      router.replace('/department-login')
      return
    }
    // Department unlocked → home (employee signs in on Home, not a separate screen)
    if (departmentToken && onDept) {
      router.replace('/')
    }
  }, [loading, departmentToken, segments, router])

  useEffect(() => {
    if (loading) return
    SplashScreen.hideAsync().catch(() => {})
  }, [loading])

  if (loading) {
    return (
      <Screen>
        <LoadingBlock label="Starting MG Factory…" />
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
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="department-login" options={{ headerShown: false }} />
                <Stack.Screen name="metal-in" options={{ title: 'METAL IN' }} />
                <Stack.Screen name="metal-out" options={{ title: 'METAL OUT' }} />
                <Stack.Screen name="alloy-in" options={{ title: 'ALLOY IN' }} />
                <Stack.Screen name="alloy-out" options={{ title: 'ALLOY OUT' }} />
                <Stack.Screen name="purity" options={{ title: 'PURITY' }} />
                <Stack.Screen name="batch-start" options={{ title: 'BATCH START' }} />
                <Stack.Screen name="batch-over" options={{ title: 'BATCH OVER' }} />
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
  configBrand: { color: colors.accent, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  configTitle: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  configBody: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
})
