import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'
import { fetchLatestMessages, type ChatMessage } from '@/src/api/messages'

export default function ChatScreen() {
  const { token } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (isRefresh = false) => {
    if (!token) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const rows = await fetchLatestMessages(token)
      setMessages(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
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

  if (loading && messages.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={mgBranding.colors.primary} />
      </View>
    )
  }

  return (
    <FlatList
      data={messages}
      keyExtractor={(item, index) => String(item._id || index)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={<Text style={styles.empty}>No messages yet</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowTop}>
            <Text style={styles.sender}>{item.senderName || 'Team'}</Text>
            <Text style={styles.time}>
              {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
            </Text>
          </View>
          <Text style={styles.body}>{item.text || item.message || '—'}</Text>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 10,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  sender: { fontWeight: '700', color: mgBranding.colors.text, flex: 1 },
  time: { fontSize: 11, color: mgBranding.colors.muted },
  body: { marginTop: 6, color: mgBranding.colors.text, fontSize: 14, lineHeight: 20 },
  empty: { textAlign: 'center', color: mgBranding.colors.muted, marginTop: 40 },
  error: { color: mgBranding.colors.danger, marginBottom: 10 },
})
