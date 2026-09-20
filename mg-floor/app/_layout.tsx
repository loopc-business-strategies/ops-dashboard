import 'react-native-gesture-handler'

import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import React, { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider, useAuth } from '@/src/context/AuthContext'
import { startAutoSync } from '@/src/offline/sync'
import { LoadingBlock, Screen } from '@/src/components/ui'
import { colors } from '@/src/theme'
import { StyleSheet } from 'react-native'

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
  return (
    <GestureHandlerRootView style={styles.root}>
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
            <Stack.Screen name="profile" options={{ title: 'PROFILE' }} />
            <Stack.Screen name="correction" options={{ title: 'WEIGHT CORRECTION' }} />
          </Stack>
        </AuthGate>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
