import { View, Text, StyleSheet, type ViewStyle } from 'react-native'
import { mgBranding } from '@/src/config/branding'

type Props = {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'success' | 'danger'
  style?: ViewStyle
}

export function StatCard({ label, value, sub, tone = 'default', style }: Props) {
  const valueColor =
    tone === 'success' ? mgBranding.colors.success :
    tone === 'danger' ? mgBranding.colors.danger :
    mgBranding.colors.text

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mgBranding.colors.card,
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
    color: mgBranding.colors.muted,
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
    color: mgBranding.colors.muted,
  },
})
