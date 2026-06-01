import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { DashboardPayload, MarginRow } from '@/src/api/dashboard'
import { mgBranding } from '@/src/config/branding'
import { fmtMoney, fmtPosition, fmtSigned } from '@/src/utils/format'
import { widgetStyles } from '@/src/components/dashboard/widgetStyles'

const MAX_ROWS = 5

function mapMarginRow(row: MarginRow, nameKey: 'customerName' | 'supplierName', favorableCredit = false) {
  const rawNet = Number(row?.equity ?? row?.netCashFlow ?? 0)
  const marginAmount = Number(row?.marginAmount || 0)
  const net = favorableCredit && rawNet < 0 ? Math.abs(rawNet) : rawNet
  const rawMargin = row?.marginPercent
  const marginPercent = Number.isFinite(Number(rawMargin))
    ? Number(rawMargin)
    : marginAmount > 0
      ? (Math.abs(net) / marginAmount) * 100
      : 0
  return {
    name: String(row?.[nameKey] || row?.name || '-'),
    equity: net,
    marginPercent,
    goldPosition: Number(row?.goldPosition || 0),
    silverPosition: Number(row?.silverPosition || 0),
  }
}

export function MarginsWidget({ dashboard }: { dashboard: DashboardPayload | null }) {
  const [tab, setTab] = useState<'customers' | 'suppliers'>('customers')
  const customers = (dashboard?.customerMargins || []).map((r) => mapMarginRow(r, 'customerName', true))
  const suppliers = (dashboard?.supplierMargins?.rows || []).map((r) => mapMarginRow(r, 'supplierName'))
  const rows = tab === 'suppliers' ? suppliers : customers

  return (
    <View>
      <View style={widgetStyles.tabRow}>
        {(['customers', 'suppliers'] as const).map((key) => (
          <Pressable
            key={key}
            style={[widgetStyles.tab, tab === key && widgetStyles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[widgetStyles.tabText, tab === key && widgetStyles.tabTextActive]}>
              {key === 'customers' ? 'Customers' : 'Suppliers'}
            </Text>
          </Pressable>
        ))}
      </View>
      {rows.length === 0 ? (
        <Text style={widgetStyles.empty}>No {tab === 'suppliers' ? 'supplier' : 'customer'} data available.</Text>
      ) : (
        <>
          <View style={widgetStyles.headerRow}>
            <Text style={[widgetStyles.headerCell, { flex: 1.4 }]}>Name</Text>
            <Text style={[widgetStyles.headerCell, widgetStyles.headerCellRight]}>Equity</Text>
            <Text style={[widgetStyles.headerCell, widgetStyles.headerCellRight, { flex: 0.7 }]}>Margin %</Text>
          </View>
          {rows.slice(0, MAX_ROWS).map((row, i) => (
            <View key={`${row.name}-${i}`} style={[widgetStyles.row, i === Math.min(rows.length, MAX_ROWS) - 1 && widgetStyles.rowLast]}>
              <View style={{ flex: 1.4 }}>
                <Text style={widgetStyles.rowLabel} numberOfLines={1}>{row.name}</Text>
                <Text style={widgetStyles.rowSub}>
                  Au {fmtPosition(row.goldPosition)} · Ag {fmtPosition(row.silverPosition)}
                </Text>
              </View>
              <Text
                style={[
                  widgetStyles.rowValue,
                  { flex: 1, textAlign: 'right', color: row.equity > 0 ? mgBranding.colors.success : row.equity < 0 ? mgBranding.colors.danger : mgBranding.colors.text },
                ]}
              >
                {fmtSigned(row.equity)}
              </Text>
              <Text style={[widgetStyles.rowValue, { flex: 0.7, textAlign: 'right' }]}>
                {Number.isFinite(row.marginPercent) ? `${row.marginPercent.toFixed(1)}%` : '—'}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  )
}
