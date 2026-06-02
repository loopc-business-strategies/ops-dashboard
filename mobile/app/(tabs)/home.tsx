import { useCallback, useState } from 'react'
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
import { renderDashboardWidget } from '@/src/components/dashboard/renderDashboardWidget'
import { ERP_DASH_WIDGETS } from '@/src/constants/erpDashboardWidgets'
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'
import { useLiveMetalTickerState } from '@/src/context/LiveMetalTickerContext'
import { fetchDashboard, type DashboardPayload } from '@/src/api/dashboard'
import { fetchLatestMessages, type ChatMessage } from '@/src/api/messages'

export default function HomeScreen() {
  const { token } = useAuth()
  const { reload: reloadMetals } = useLiveMetalTickerState()
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (isRefresh = false) => {
    if (!token) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [dash, messagesRaw] = await Promise.all([
        fetchDashboard(token),
        fetchLatestMessages(token, 'group', 10).catch(() => [] as ChatMessage[]),
        reloadMetals(),
      ])
      setDashboard(dash)
      setChatMessages(messagesRaw)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, reloadMetals])

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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>My Dashboard</Text>
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
          })}
        </DashboardWidgetCard>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: mgBranding.colors.muted,
    marginTop: 8,
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  error: { color: mgBranding.colors.danger, marginBottom: 10 },
})
