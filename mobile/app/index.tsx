import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useTenantBranding } from '@/src/context/TenantContext'
import { useAuth } from '@/src/context/AuthContext'

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuth()
  const { branding } = useTenantBranding()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: branding.colors.background }}>
        <ActivityIndicator size="large" color={branding.colors.primary} />
      </View>
    )
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />
  }

  return <Redirect href="/login" />
}
