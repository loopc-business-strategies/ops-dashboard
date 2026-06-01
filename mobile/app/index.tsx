import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: mgBranding.colors.background }}>
        <ActivityIndicator size="large" color={mgBranding.colors.primary} />
      </View>
    )
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />
  }

  return <Redirect href="/login" />
}
