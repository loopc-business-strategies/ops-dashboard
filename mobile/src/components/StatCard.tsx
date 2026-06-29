import { View, Text, StyleSheet, type ViewStyle } from 'react-native'
import { useTenant } from '@/src/context/TenantContext'
import { useBrandingStyles } from '@/src/hooks/useBrandingStyles'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'

type Props = {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'success' | 'danger'
  style?: ViewStyle
}

function createStatCardStyles(branding: MobileTenantBranding) {
  const { colors } = branding
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      flex: 1,
      minWidth: '46%',
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    value: {
      marginTop: 6,
      fontSize: 18,
      fontWeight: '800',
    },
    sub: {
      marginTop: 4,
      fontSize: 12,
      color: colors.muted,
    },
  })
}

export function StatCard({ label, value, sub, tone = 'default', style }: Props) {
  const styles = useBrandingStyles(createStatCardStyles)
  const { branding } = useTenant()

  const valueColor =
    tone === 'success' ? branding.colors.success :
    tone === 'danger' ? branding.colors.danger :
    branding.colors.text

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  )
}
