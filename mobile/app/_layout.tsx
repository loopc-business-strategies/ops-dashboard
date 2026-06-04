import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { AuthProvider, useAuth } from '@/src/context/AuthContext'
import { ChatProvider } from '@/src/context/ChatContext'
import { NotificationsProvider } from '@/src/context/NotificationsContext'
import { mgBranding } from '@/src/config/branding'
import { initMobileSentry } from '@/src/lib/sentryInit'

initMobileSentry()

export { ErrorBoundary } from 'expo-router'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

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
  }, [isAuthenticated, isLoading, router, segments])

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: mgBranding.colors.background }}>
        <ActivityIndicator size="large" color={mgBranding.colors.primary} />
      </View>
    )
  }

  return children
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <ChatProvider>
          <NotificationsProvider>
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
          </NotificationsProvider>
        </ChatProvider>
      </AuthGate>
    </AuthProvider>
  )
}
