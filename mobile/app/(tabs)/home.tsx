import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { DashboardWidgetCard } from '@/src/components/dashboard/DashboardWidgetCard'
import { LiveMetalPricesBar } from '@/src/components/dashboard/LiveMetalPricesBar'
import { renderDashboardWidget } from '@/src/components/dashboard/renderDashboardWidget'
import { ERP_DASH_WIDGETS } from '@/src/constants/erpDashboardWidgets'
import { useAuth } from '@/src/context/AuthContext'
import { useTenantBranding } from '@/src/context/TenantContext'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import { useTenantSessionKey } from '@/src/hooks/useTenantSessionKey'
import { useLiveMetalRates } from '@/src/hooks/useLiveMetalRates'
import { fetchDashboard, type DashboardPayload } from '@/src/api/dashboard'
import { fetchLatestMessages, type ChatMessage } from '@/src/api/messages'
import { resolveEffectiveSpotPrices } from '@/src/utils/liveMetalRates'

export default function HomeScreen() {
  const { token } = useAuth()
  const { branding } = useTenantBranding()
  const sessionReady = useTenantSessionReady()
  const tenantSessionKey = useTenantSessionKey()
  const tenantSessionKeyRef = useRef(tenantSessionKey)
  tenantSessionKeyRef.current = tenantSessionKey
  const { snapshot: liveSnapshot, refresh: refreshLiveMetalRates } = useLiveMetalRates()
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDashboard(null)
    setChatMessages([])
    setError('')
    setLoading(true)
  }, [tenantSessionKey])

  const load = useCallback(async (isRefresh = false) => {
    if (!token || !sessionReady) return
    const sessionAtStart = tenantSessionKeyRef.current
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [dash, messagesRaw] = await Promise.all([
        fetchDashboard(token),
        fetchLatestMessages(token, 'group', 10).catch(() => [] as ChatMessage[]),
        isRefresh ? refreshLiveMetalRates() : Promise.resolve(),
      ])
      if (sessionAtStart !== tenantSessionKeyRef.current) return
      setDashboard(dash)
      setChatMessages(messagesRaw)
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

  const { goldPriceUSD, silverPriceUSD } = resolveEffectiveSpotPrices({ liveSnapshot })
  const liveRecalcEnabled = goldPriceUSD > 0 || silverPriceUSD > 0

  if (!sessionReady || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={branding.colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: branding.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      {error ? <Text style={[styles.error, { color: branding.colors.danger }]}>{error}</Text> : null}

      <LiveMetalPricesBar />

      <Text style={[styles.section, { color: branding.colors.muted }]}>My Dashboard</Text>
      {ERP_DASH_WIDGETS.map((widget) => (
        <DashboardWidgetCard
          key={widget.id}
          icon={widget.icon}
          title={widget.label}
          footerLabel={widget.id === 'chat' ? 'Open full chat →' : undefined}
          onFooterPress={widget.id === 'chat' ? () => router.push('/(tabs)/chat' as never) : undefined}
        >
          {renderDashboardWidget({
            id: widget.id,
            dashboard,
            chatMessages,
            goldPriceUSD,
            silverPriceUSD,
            liveRecalcEnabled,
          })}
        </DashboardWidgetCard>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
