import { Stack } from 'expo-router'
import { useTenant } from '@/src/context/TenantContext'

export default function ChatStackLayout() {
  const { branding } = useTenant()

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: branding.colors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="[chatId]" options={{ title: 'Conversation' }} />
      <Stack.Screen name="create-group" options={{ title: 'Create group', presentation: 'modal' }} />
    </Stack>
  )
}
