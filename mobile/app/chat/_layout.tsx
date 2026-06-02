import { Stack } from 'expo-router'
import { mgBranding } from '@/src/config/branding'

export default function ChatStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: mgBranding.colors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="[chatId]" options={{ title: 'Conversation' }} />
      <Stack.Screen name="create-group" options={{ title: 'Create group', presentation: 'modal' }} />
    </Stack>
  )
}
