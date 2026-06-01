import { StyleSheet, Text, View } from 'react-native'
import { ROLE_COLORS, ROLES } from '@/src/constants/admin'

type Props = {
  role: string
}

export function RoleBadge({ role }: Props) {
  const colors = ROLE_COLORS[role] || { bg: '#F3F4F6', text: '#374151' }
  const label = ROLES.find((r) => r.value === role)?.label || role

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
})
