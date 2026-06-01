import { Text, View } from 'react-native'
import type { DashboardPayload } from '@/src/api/dashboard'
import { fmtMoney } from '@/src/utils/format'
import { widgetStyles } from '@/src/components/dashboard/widgetStyles'

export function BankWidget({ dashboard }: { dashboard: DashboardPayload | null }) {
  const allRows = [...(dashboard?.bankBalances || []), ...(dashboard?.cashBalances || [])]
  const total = allRows.reduce((s, a) => s + Number(a.balance || 0), 0)

  if (allRows.length === 0) {
    return <Text style={widgetStyles.empty}>No accounts found.</Text>
  }

  return (
    <View>
      {allRows.map((row, i) => (
        <View key={`${row.accountName}-${i}`} style={[widgetStyles.row, i === allRows.length - 1 && widgetStyles.rowLast]}>
          <View style={{ flex: 1 }}>
            <Text style={widgetStyles.rowLabel}>{row.accountName || 'Account'}</Text>
            {row.accountCode ? <Text style={widgetStyles.rowSub}>{row.accountCode}</Text> : null}
          </View>
          <Text style={widgetStyles.rowValue}>{fmtMoney(row.balance)}</Text>
        </View>
      ))}
      <View style={widgetStyles.footerTotal}>
        <Text style={widgetStyles.footerTotalLabel}>Total</Text>
        <Text style={widgetStyles.footerTotalValue}>{fmtMoney(total)}</Text>
      </View>
    </View>
  )
}
