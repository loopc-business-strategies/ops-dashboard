import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { AuthProvider, useAuth } from '@/src/context/AuthContext'
import { mgBranding } from '@/src/config/branding'

export { ErrorBoundary } from 'expo-router'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    const inAuthGroup = segments[0] === 'login'
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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="plus-modal"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Quick actions',
            }}
          />
        </Stack>
      </AuthGate>
    </AuthProvider>
  )
}
