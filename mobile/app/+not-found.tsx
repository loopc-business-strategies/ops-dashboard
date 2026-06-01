import { Link, Stack } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'

export default function NotFoundScreen() {
  const { isAuthenticated } = useAuth()
  const homeHref = isAuthenticated ? '/(tabs)/home' : '/login'

  return (
    <>
      <Stack.Screen options={{ title: 'Not found', headerShown: false }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
        <Link href={homeHref} style={styles.link}>
          <Text style={styles.linkText}>
            {isAuthenticated ? 'Go to home screen' : 'Go to sign in'}
          </Text>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: mgBranding.colors.secondary,
  },
})
