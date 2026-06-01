import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { StatCard } from '@/src/components/StatCard'
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'
import { fetchDashboard, fetchLiveMetalRates, type DashboardPayload } from '@/src/api/dashboard'
import { fmtMoney } from '@/src/utils/format'

export default function HomeScreen() {
  const { token } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [gold, setGold] = useState<number | null>(null)
  const [silver, setSilver] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (isRefresh = false) => {
    if (!token) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [dash, metalsRaw] = await Promise.all([
        fetchDashboard(token),
        fetchLiveMetalRates(token).catch(() => null),
      ])
      setDashboard(dash)
      setGold(metalsRaw?.goldPrice != null ? Number(metalsRaw.goldPrice) : null)
      setSilver(metalsRaw?.silverPrice != null ? Number(metalsRaw.silverPrice) : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useFocusEffect(
    useCallback(() => {
      load(false)
    }, [load]),
  )

  if (loading && !dashboard) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={mgBranding.colors.primary} />
      </View>
    )
  }

  const apAr = dashboard?.apAr || {}
  const alerts = [
    Number(dashboard?.vendorComplianceRisk?.nonCompliant || 0) > 0 && {
      icon: '⚠️',
      text: `${dashboard?.vendorComplianceRisk?.nonCompliant} vendor(s) at compliance risk`,
    },
    (Number(dashboard?.vendorDocumentExpiry?.warning30 || 0) > 0 ||
      Number(dashboard?.vendorDocumentExpiry?.warning60 || 0) > 0) && {
      icon: '📄',
      text: `Doc expiry: ${dashboard?.vendorDocumentExpiry?.warning30 || 0} in 30d · ${dashboard?.vendorDocumentExpiry?.warning60 || 0} in 60d`,
    },
    (dashboard?.lowStockAlerts?.length || 0) > 0 && {
      icon: '📦',
      text: `${dashboard?.lowStockAlerts?.length} item(s) below minimum stock`,
    },
  ].filter(Boolean) as Array<{ icon: string; text: string }>

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>Overview</Text>
      <View style={styles.grid}>
        <StatCard label="Receivable (AR)" value={fmtMoney(apAr.totalAR)} sub={`${apAr.arCount || 0} open`} tone="success" />
        <StatCard label="Payable (AP)" value={fmtMoney(apAr.totalAP)} sub={`${apAr.apCount || 0} pending`} tone="danger" />
        <StatCard
          label="Net position"
          value={fmtMoney(apAr.netPosition)}
          sub={Number(apAr.netPosition || 0) >= 0 ? 'Favorable' : 'Deficit'}
          tone={Number(apAr.netPosition || 0) >= 0 ? 'success' : 'danger'}
        />
        <StatCard label="Expenses (period)" value={fmtMoney(dashboard?.expenses?.total)} sub={`YTD ${fmtMoney(dashboard?.expenses?.ytdTotal)}`} />
      </View>

      <Text style={styles.section}>Live metals</Text>
      <View style={styles.grid}>
        <StatCard label="Gold" value={gold != null && Number.isFinite(gold) ? fmtMoney(gold) : '—'} />
        <StatCard label="Silver" value={silver != null && Number.isFinite(silver) ? fmtMoney(silver) : '—'} />
      </View>

      <Text style={styles.section}>Cash & bank</Text>
      <View style={styles.listCard}>
        {[...(dashboard?.bankBalances || []), ...(dashboard?.cashBalances || [])].slice(0, 6).map((row, i) => (
          <View key={`${row.accountName}-${i}`} style={styles.listRow}>
            <Text style={styles.listLabel}>{row.accountName || 'Account'}</Text>
            <Text style={styles.listValue}>{fmtMoney(row.balance)}</Text>
          </View>
        ))}
        {!(dashboard?.bankBalances?.length || dashboard?.cashBalances?.length) ? (
          <Text style={styles.empty}>No cash/bank balances</Text>
        ) : null}
      </View>

      <Text style={styles.section}>Alerts</Text>
      <View style={styles.listCard}>
        {alerts.length === 0 ? (
          <Text style={styles.empty}>No active alerts</Text>
        ) : (
          alerts.map((item, i) => (
            <View key={i} style={styles.alertRow}>
              <Text style={styles.alertIcon}>{item.icon}</Text>
              <Text style={styles.alertText}>{item.text}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 13, fontWeight: '800', color: mgBranding.colors.muted, marginTop: 8, marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  listCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 12 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  listLabel: { color: mgBranding.colors.text, fontSize: 14, flex: 1, paddingRight: 8 },
  listValue: { color: mgBranding.colors.text, fontWeight: '700', fontSize: 14 },
  alertRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  alertIcon: { fontSize: 18 },
  alertText: { flex: 1, color: mgBranding.colors.text, fontSize: 14, lineHeight: 20 },
  empty: { color: mgBranding.colors.muted, fontSize: 14, paddingVertical: 8 },
  error: { color: mgBranding.colors.danger, marginBottom: 10 },
})
