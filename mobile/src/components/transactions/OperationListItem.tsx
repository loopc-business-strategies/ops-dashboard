import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import type { OperationEntry } from '@/src/utils/operationsFeed'
import { categoryLabel, formatMoneyAmount } from '@/src/utils/operationsFeed'
import type { OperationsStyles } from '@/src/components/transactions/operationsStyles'

type OperationListItemProps = {
  entry: OperationEntry
  styles: OperationsStyles
  branding: MobileTenantBranding
  onPress: () => void
}

function iconColor(entry: OperationEntry, branding: MobileTenantBranding): string {
  if (entry.categoryKey === 'jv_bank') return '#3B82F6'
  if (entry.categoryKey === 'jv_journal') return '#8B5CF6'
  if (entry.isIncome) return branding.colors.success
  if (entry.isOutcome) return branding.colors.danger
  return branding.colors.primary
}

function iconGlyph(entry: OperationEntry): string {
  if (entry.kind === 'jv') return entry.jvType === 'bank_jv' ? 'B' : 'J'
  const t = String(entry.row.type || '').toLowerCase()
  if (t.includes('metal')) return 'M'
  if (t === 'receipt' || t === 'sale') return '+'
  if (t === 'payment' || t === 'purchase' || t === 'expense') return '↑'
  return '•'
}

function OperationListItem({ entry, branding, onPress }: OperationListItemProps) {
  const color = iconColor(entry, branding)
  const signed = entry.isIncome ? entry.amount : entry.isOutcome ? -Math.abs(entry.amount) : entry.amount
  const itemStyles = useItemStyles(branding)

  return (
    <Pressable style={itemStyles.row} onPress={onPress}>
      <View style={[itemStyles.iconCircle, { backgroundColor: `${color}18` }]}>
        <Text style={[itemStyles.iconText, { color }]}>{iconGlyph(entry)}</Text>
      </View>
      <View style={itemStyles.body}>
        <Text style={itemStyles.title} numberOfLines={1}>
          {entry.title}
        </Text>
        <Text style={itemStyles.subtitle} numberOfLines={1}>
          {entry.subtitle || categoryLabel(entry.categoryKey)}
        </Text>
      </View>
      <View style={itemStyles.amountCol}>
        <Text style={itemStyles.amount}>{formatMoneyAmount(signed, entry.currency, true)}</Text>
        <Text style={itemStyles.accountRef} numberOfLines={1}>
          {entry.accountRef}
        </Text>
      </View>
    </Pressable>
  )
}

function useItemStyles(b: MobileTenantBranding) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: '#FFFFFF',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#E5E7EB',
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    iconText: { fontSize: 16, fontWeight: '800' },
    body: { flex: 1, minWidth: 0 },
    title: { fontSize: 15, fontWeight: '700', color: b.colors.text },
    subtitle: { fontSize: 12, color: b.colors.muted, marginTop: 2 },
    amountCol: { alignItems: 'flex-end', maxWidth: '42%' },
    amount: { fontSize: 14, fontWeight: '700', color: b.colors.text },
    accountRef: { fontSize: 11, color: b.colors.muted, marginTop: 2 },
  })
}

export default memo(OperationListItem)
