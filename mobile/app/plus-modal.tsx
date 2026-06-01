import { StyleSheet, Text, View } from 'react-native'
import { mgBranding } from '@/src/config/branding'

export default function PlusModalScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Coming soon</Text>
      <Text style={styles.body}>
        Quick actions (new voucher, notes, and more) will appear here in a future update.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: mgBranding.colors.background },
  title: { fontSize: 22, fontWeight: '800', color: mgBranding.colors.text },
  body: { marginTop: 10, fontSize: 15, lineHeight: 22, color: mgBranding.colors.muted },
})
