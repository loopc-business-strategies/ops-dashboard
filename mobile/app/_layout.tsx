import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context'
import { Stack, useRouter, useSegments } from 'expo-router'
import { AuthProvider, useAuth } from '@/src/context/AuthContext'
import { TenantProvider, useTenantBranding } from '@/src/context/TenantContext'
import { ChatProvider } from '@/src/context/ChatContext'
import { NotificationsProvider } from '@/src/context/NotificationsContext'
import { LiveMetalRatesProvider } from '@/src/context/LiveMetalRatesContext'
import { initMobileSentry } from '@/src/lib/sentryInit'

import { useDeepLinkNavigation } from '@/src/navigation/useDeepLinkNavigation'

initMobileSentry()

function DeepLinkNavigationBridge() {
  useDeepLinkNavigation()
  return null
}

export { ErrorBoundary } from 'expo-router'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const { branding, isReady } = useTenantBranding()
  const segments = useSegments()
  const router = useRouter()
  const bootstrapping = isLoading || !isReady

  useEffect(() => {
    if (bootstrapping) return

    const root = segments[0]
    const inAuthGroup = root === 'login'
    const onMissingRoute = root === '+not-found'

    if (onMissingRoute) {
      router.replace(isAuthenticated ? '/(tabs)/home' : '/login')
      return
    }

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login')
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/home')
    }
  }, [isAuthenticated, bootstrapping, router, segments])

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: branding.colors.background }}>
        <ActivityIndicator size="large" color={branding.colors.primary} />
      </View>
    )
  }

  return children
}

function SessionScopedProviders({ children }: { children: React.ReactNode }) {
  const { tenantSessionKey } = useAuth()

  return (
    <ChatProvider key={tenantSessionKey}>
      <NotificationsProvider key={tenantSessionKey}>
        <LiveMetalRatesProvider key={tenantSessionKey}>{children}</LiveMetalRatesProvider>
      </NotificationsProvider>
    </ChatProvider>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <TenantProvider>
      <AuthProvider>
        <AuthGate>
          <SessionScopedProviders>
              <DeepLinkNavigationBridge />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="chat" options={{ headerShown: false }} />
                <Stack.Screen name="admin-settings" options={{ headerShown: false }} />
                <Stack.Screen
                  name="plus-modal"
                  options={{
                    presentation: 'modal',
                    headerShown: true,
                    title: 'Quick actions',
                  }}
                />
              </Stack>
          </SessionScopedProviders>
        </AuthGate>
      </AuthProvider>
      </TenantProvider>
    </SafeAreaProvider>
  )
}
