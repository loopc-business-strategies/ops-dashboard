import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import DonutChart, { donutSegmentColors } from '@/src/components/transactions/DonutChart'
import type { CategorySummary } from '@/src/utils/operationsFeed'
import { formatMoneyAmount } from '@/src/utils/operationsFeed'
import type { OperationsStyles } from '@/src/components/transactions/operationsStyles'

type FinancialAnalysisViewProps = {
  mode: 'outcome' | 'income'
  total: number
  currency: string
  periodLabel: string
  categories: CategorySummary[]
  branding: MobileTenantBranding
  styles: OperationsStyles
  onBack: () => void
  onSelectCategory: (categoryKey: string) => void
}

export default function FinancialAnalysisView({
  mode,
  total,
  currency,
  periodLabel,
  categories,
  branding,
  styles,
  onBack,
  onSelectCategory,
}: FinancialAnalysisViewProps) {
  const filtered = categories.filter((c) => (mode === 'outcome' ? c.isOutcome : c.isIncome))
  const colors = donutSegmentColors(mode === 'outcome' ? branding.colors.danger : branding.colors.success)
  const segments = filtered.slice(0, 5).map((c, i) => ({
    value: c.totalAmount,
    color: colors[i % colors.length],
    label: c.label,
  }))
  const cardStyles = useCardStyles(branding)
  const amountColor = mode === 'outcome' ? branding.colors.danger : branding.colors.success

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.subHeader}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.subHeaderTitle}>Financial Analysis</Text>
      </View>

      <View style={cardStyles.card}>
        <Text style={cardStyles.cardTitle}>Financial Analysis</Text>
        <Text style={[cardStyles.heroAmount, { color: amountColor }]}>
          {formatMoneyAmount(mode === 'outcome' ? -total : total, currency, true)}
        </Text>
        <Text style={cardStyles.heroLabel}>{mode === 'outcome' ? 'Outcome' : 'Income'}</Text>

        <View style={cardStyles.chartWrap}>
          <DonutChart segments={segments} centerLabel={periodLabel} />
          <Text style={cardStyles.centerLabel}>for {periodLabel}</Text>
        </View>

        <Text style={cardStyles.categoriesTitle}>Categories</Text>
        {filtered.map((cat, i) => {
          const pct = total > 0 ? Math.round((cat.totalAmount / total) * 100) : 0
          return (
            <Pressable key={cat.categoryKey} style={cardStyles.catRow} onPress={() => onSelectCategory(cat.categoryKey)}>
              <View style={[cardStyles.catIcon, { backgroundColor: `${colors[i % colors.length]}22` }]}>
                <Text style={{ color: colors[i % colors.length], fontWeight: '800' }}>{pct}%</Text>
              </View>
              <View style={cardStyles.catBody}>
                <Text style={cardStyles.catTitle}>{cat.label}</Text>
                <Text style={cardStyles.catSub}>
                  {cat.count} operation{cat.count === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={cardStyles.catAmount}>
                {formatMoneyAmount(mode === 'outcome' ? -cat.totalAmount : cat.totalAmount, currency, true)}
              </Text>
            </Pressable>
          )
        })}
        {filtered.length === 0 ? (
          <Text style={cardStyles.empty}>No {mode} operations in this period.</Text>
        ) : null}
      </View>
    </ScrollView>
  )
}

function useCardStyles(b: MobileTenantBranding) {
  return StyleSheet.create({
    card: {
      marginHorizontal: 12,
      backgroundColor: '#F3F4F6',
      borderRadius: 20,
      padding: 16,
    },
    cardTitle: { fontSize: 13, fontWeight: '600', color: b.colors.muted },
    heroAmount: { fontSize: 26, fontWeight: '800', marginTop: 8 },
    heroLabel: { fontSize: 14, color: b.colors.muted, marginBottom: 12 },
    chartWrap: { alignItems: 'center', marginVertical: 8 },
    centerLabel: { textAlign: 'center', fontSize: 12, color: b.colors.muted, marginTop: -48, marginBottom: 24 },
    categoriesTitle: { fontSize: 16, fontWeight: '700', color: b.colors.text, marginTop: 8, marginBottom: 8 },
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#E5E7EB',
    },
    catIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    catBody: { flex: 1 },
    catTitle: { fontSize: 14, fontWeight: '700', color: b.colors.text },
    catSub: { fontSize: 12, color: b.colors.muted, marginTop: 2 },
    catAmount: { fontSize: 13, fontWeight: '700', color: b.colors.text },
    empty: { fontSize: 13, color: b.colors.muted, paddingVertical: 12 },
  })
}
