import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import { formatMoneyAmount } from '@/src/utils/operationsFeed'

type OutcomeIncomeCardsProps = {
  outcome: number
  income: number
  currency: string
  branding: MobileTenantBranding
  onPressOutcome: () => void
  onPressIncome: () => void
}

export default function OutcomeIncomeCards({
  outcome,
  income,
  currency,
  branding,
  onPressOutcome,
  onPressIncome,
}: OutcomeIncomeCardsProps) {
  const total = outcome + income || 1
  const outcomePct = outcome / total
  const incomePct = income / total
  const styles = useStyles(branding)

  return (
    <View style={styles.row}>
      <Pressable style={styles.card} onPress={onPressOutcome}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>Outcome</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
        <Text style={[styles.amount, { color: branding.colors.danger }]}>
          {formatMoneyAmount(-outcome, currency, true)}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(outcomePct * 100)}%`, backgroundColor: branding.colors.danger }]} />
        </View>
      </Pressable>
      <Pressable style={styles.card} onPress={onPressIncome}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>Income</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
        <Text style={[styles.amount, { color: branding.colors.success }]}>
          {formatMoneyAmount(income, currency, true)}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(incomePct * 100)}%`, backgroundColor: branding.colors.success }]} />
        </View>
      </Pressable>
    </View>
  )
}

function useStyles(b: MobileTenantBranding) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      gap: 10,
      marginBottom: 8,
    },
    card: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardLabel: { fontSize: 13, fontWeight: '600', color: b.colors.muted },
    chevron: { fontSize: 18, color: b.colors.muted },
    amount: { fontSize: 15, fontWeight: '800', marginTop: 6, marginBottom: 10 },
    track: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, overflow: 'hidden' },
    fill: { height: 4, borderRadius: 2 },
  })
}
