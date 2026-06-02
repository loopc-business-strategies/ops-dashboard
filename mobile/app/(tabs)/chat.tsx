import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'
import { useChat } from '@/src/context/ChatContext'
import { previewText } from '@/src/utils/chat'
import { canCreateChatGroup } from '@/src/utils/roles'

export default function ChatListScreen() {
  const { user } = useAuth()
  const { conversations, loading, error, refresh } = useChat()
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        previewText(c).toLowerCase().includes(q) ||
        String(c.dept || '').toLowerCase().includes(q),
    )
  }, [conversations, search])

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  const openChat = (chatId: string) => {
    router.push({ pathname: '/chat/[chatId]' as never, params: { chatId } })
  }

  if (loading && conversations.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={mgBranding.colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search chats…"
          placeholderTextColor={mgBranding.colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {canCreateChatGroup(user) ? (
        <Pressable style={styles.newGroupBtn} onPress={() => router.push('/chat/create-group' as never)}>
          <Text style={styles.newGroupText}>+ Create group</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet</Text>}
        renderItem={({ item }) => {
          const last = item.messages[item.messages.length - 1]
          const timeLabel = last?.time
            ? new Date(last.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : ''
          return (
            <Pressable style={styles.row} onPress={() => openChat(item.id)}>
              <View style={[styles.avatar, { backgroundColor: item.type === 'group' ? mgBranding.colors.primary : '#14b8a6' }]}>
                <Text style={styles.avatarText}>
                  {item.type === 'group' ? item.name.slice(0, 2).toUpperCase() : item.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.time}>{timeLabel}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {previewText(item)}
                </Text>
                {item.type === 'group' ? (
                  <Text style={styles.meta}>{item.dept || 'Group'} · {item.members?.length || 0} members</Text>
                ) : (
                  <Text style={styles.meta}>Direct message</Text>
                )}
              </View>
              {item.unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unread}</Text>
                </View>
              ) : null}
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { padding: 12, paddingBottom: 0 },
  search: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: mgBranding.colors.text,
  },
  newGroupBtn: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: '#E8F5EF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  newGroupText: { color: mgBranding.colors.success, fontWeight: '800', fontSize: 14 },
  list: { padding: 12, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 10,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontWeight: '800', fontSize: 15, color: mgBranding.colors.text },
  time: { fontSize: 11, color: mgBranding.colors.muted },
  preview: { marginTop: 4, fontSize: 13, color: mgBranding.colors.muted },
  meta: { marginTop: 2, fontSize: 11, color: mgBranding.colors.muted },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: mgBranding.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  empty: { textAlign: 'center', color: mgBranding.colors.muted, marginTop: 40 },
  error: { color: mgBranding.colors.danger, paddingHorizontal: 12, paddingBottom: 8 },
})
