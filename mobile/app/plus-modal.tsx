import { StyleSheet, Text, View } from 'react-native'
import { useBrandingStyles } from '@/src/hooks/useBrandingStyles'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'

function createPlusModalStyles(branding: MobileTenantBranding) {
  const { colors } = branding
  return StyleSheet.create({
    root: { flex: 1, padding: 24, backgroundColor: colors.background },
    title: { fontSize: 22, fontWeight: '800', color: colors.text },
    body: { marginTop: 10, fontSize: 15, lineHeight: 22, color: colors.muted },
  })
}

export default function PlusModalScreen() {
  const styles = useBrandingStyles(createPlusModalStyles)

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Coming soon</Text>
      <Text style={styles.body}>
        Quick actions (new voucher, notes, and more) will appear here in a future update.
      </Text>
    </View>
  )
}
