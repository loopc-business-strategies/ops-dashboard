import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/src/context/AuthContext'
import { mgBranding } from '@/src/config/branding'
import { isSuperAdmin } from '@/src/utils/roles'

export default function AdminSettingsLayout() {
  const { user } = useAuth()

  if (!isSuperAdmin(user)) {
    return <Redirect href="/(tabs)/settings" />
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: mgBranding.colors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: mgBranding.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin settings' }} />
      <Stack.Screen name="create" options={{ title: 'Create user' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit user' }} />
      <Stack.Screen name="permissions/[id]" options={{ title: 'Permissions' }} />
    </Stack>
  )
}
