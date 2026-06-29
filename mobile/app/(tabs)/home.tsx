import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { DashboardWidgetCard } from '@/src/components/dashboard/DashboardWidgetCard'
import { LiveMetalPricesBar } from '@/src/components/dashboard/LiveMetalPricesBar'
import { renderDashboardWidget } from '@/src/components/dashboard/renderDashboardWidget'
import { ERP_DASH_WIDGETS } from '@/src/constants/erpDashboardWidgets'
import { useAuth } from '@/src/context/AuthContext'
import { useTenant } from '@/src/context/TenantContext'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import { useTenantSessionKey } from '@/src/hooks/useTenantSessionKey'
import { useLiveMetalRates } from '@/src/hooks/useLiveMetalRates'
import { useErpLiveMetalSpotPrices } from '@/src/hooks/useErpLiveMetalSpotPrices'
import { fetchDashboard, type DashboardPayload } from '@/src/api/dashboard'

export default function HomeScreen() {
  const { token } = useAuth()
  const { branding } = useTenant()
  const sessionReady = useTenantSessionReady()
  const tenantSessionKey = useTenantSessionKey()
  const tenantSessionKeyRef = useRef(tenantSessionKey)
  tenantSessionKeyRef.current = tenantSessionKey
  const { refresh: refreshLiveMetalRates } = useLiveMetalRates()
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    setDashboard(null)
    setError('')
    setLoading(true)
  }, [tenantSessionKey])

  const load = useCallback(async (isRefresh = false) => {
    if (!token || !sessionReady) {
      setLoading(false)
      setRefreshing(false)
      return
    }
    const sessionAtStart = tenantSessionKeyRef.current
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [dash] = await Promise.all([
        fetchDashboard(token),
        isRefresh ? refreshLiveMetalRates() : Promise.resolve(),
      ])
      if (sessionAtStart !== tenantSessionKeyRef.current) return
      setDashboard(dash)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      if (sessionAtStart !== tenantSessionKeyRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      if (sessionAtStart === tenantSessionKeyRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [token, sessionReady, tenantSessionKey, refreshLiveMetalRates])

  useFocusEffect(
    useCallback(() => {
      load(false)
    }, [load]),
  )

  const { goldPriceUSD, silverPriceUSD, liveRecalcEnabled } = useErpLiveMetalSpotPrices()

  if (!sessionReady) {
    return (
      <View style={styles.center}>
        <Text style={[styles.emptyState, { color: branding.colors.muted }]}>Preparing your company session…</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: branding.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <LiveMetalPricesBar />

      {loading && !refreshing ? (
        <View style={styles.centerInline}>
          <ActivityIndicator color={branding.colors.primary} />
        </View>
      ) : null}

      {error ? <Text style={[styles.error, { color: branding.colors.danger }]}>{error}</Text> : null}

      {!loading || refreshing ? (
        <>
          <Text style={[styles.section, { color: branding.colors.muted }]}>My Dashboard</Text>
          {ERP_DASH_WIDGETS.map((widget) => (
            <DashboardWidgetCard key={widget.id} icon={widget.icon} title={widget.label}>
              {renderDashboardWidget({
                id: widget.id,
                dashboard,
                goldPriceUSD,
                silverPriceUSD,
                liveRecalcEnabled,
                refreshKey,
              })}
            </DashboardWidgetCard>
          ))}
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerInline: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  emptyState: { fontSize: 14, fontWeight: '700', textAlign: 'center', paddingHorizontal: 24 },
  section: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  error: { marginBottom: 10 },
})
