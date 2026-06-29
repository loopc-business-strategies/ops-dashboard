import { useMemo, useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SymbolView } from 'expo-symbols'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTenant } from '@/src/context/TenantContext'
import { useChat } from '@/src/context/ChatContext'
import { useNotifications, type AppNotificationItem } from '@/src/context/NotificationsContext'
import { navigateDeepLink } from '@/src/navigation/deepLinkRouter'
import { resolveMobileNotificationRoute } from '@/src/notifications/resolveNotificationRoute'

export type AppTabsHeaderProps = {
  options: { title?: string }
  route: { name: string }
}

function resolveTitle(routeName: string, rawTitle: string | undefined): string {
  const t = String(rawTitle ?? '').trim()
  if (t) return t
  const map: Record<string, string> = {
    home: 'Home',
    erp: 'ERP',
    chat: 'Chat',
    transactions: 'Transactions',
    settings: 'Settings',
    index: '',
  }
  return map[routeName] ?? routeName
}

function formatRelativeTime(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

/** Custom tab header: title bar + chat icon + real-time notifications bell (Socket.IO `/notifications`). */
export function AppTabsHeader({ options, route }: AppTabsHeaderProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { branding } = useTenant()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { backgroundColor: branding.colors.primary },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingBottom: 10,
          paddingHorizontal: 8,
          backgroundColor: branding.colors.primary,
        },
        sideSlot: {
          width: 48,
          minHeight: 40,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sideSlotRight: {
          width: 'auto',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 2,
          paddingRight: 4,
        },
        titleCenter: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        titleText: {
          color: '#FFFFFF',
          fontWeight: '700',
          fontSize: 17,
        },
        headerIconWrap: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
        },
        bellPressed: { opacity: 0.75 },
        badge: {
          position: 'absolute',
          top: 2,
          right: 4,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: '#EF4444',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
        },
        badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        },
        modalCard: {
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '72%',
          paddingTop: 12,
        },
        modalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingBottom: 8,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: '#E5E7EB',
        },
        modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
        modalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        markAll: { fontSize: 14, fontWeight: '600', color: branding.colors.primary },
        close: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
        empty: { padding: 24, textAlign: 'center', color: '#6B7280', fontSize: 15 },
        list: { flexGrow: 0 },
        listContent: { paddingBottom: 8 },
        notifRow: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: '#E5E7EB',
        },
        notifRowUnread: { backgroundColor: '#F0FDF4' },
        notifTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
        notifMsg: { fontSize: 14, color: '#374151', lineHeight: 20 },
        notifTime: { marginTop: 6, fontSize: 12, color: '#9CA3AF' },
      }),
    [branding],
  )
  const title = resolveTitle(route.name, options.title)
  const { unreadCount: chatUnreadCount } = useChat()
  const { items, unreadCount, markRead, markAllRead } = useNotifications()
  const [modalOpen, setModalOpen] = useState(false)

  const handleNotificationPress = (item: AppNotificationItem) => {
    markRead(item.id)
    const target = resolveMobileNotificationRoute(item)
    if (!target) return
    setModalOpen(false)
    if (target.screen === 'chat') {
      router.push({ pathname: '/chat/[chatId]' as never, params: { chatId: target.chatId } })
      return
    }
    if (target.screen === 'transactions') {
      router.push('/(tabs)/transactions' as never)
      return
    }
    navigateDeepLink(router, {
      screen: 'erp',
      erpSubTab: target.erpSubTab,
      account: target.account,
      view: target.view,
    })
  }

  const renderRow = ({ item }: { item: AppNotificationItem }) => (
    <TouchableOpacity
      style={[styles.notifRow, !item.read && styles.notifRowUnread]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.notifTitle}>{item.title}</Text>
      <Text style={styles.notifMsg} numberOfLines={3}>
        {item.message}
      </Text>
      <Text style={styles.notifTime}>{formatRelativeTime(item.createdAt)}</Text>
    </TouchableOpacity>
  )

  return (
    <View style={styles.wrap}>
      <View style={[styles.titleRow, { paddingTop: insets.top }]}>
        <View style={styles.sideSlot} />
        <View style={styles.titleCenter}>
          <Text style={styles.titleText}>{title || ' '}</Text>
        </View>
        <View style={[styles.sideSlot, styles.sideSlotRight]}>
          <Pressable
            accessibilityLabel={
              chatUnreadCount > 0 ? `Chat, ${chatUnreadCount} unread` : 'Chat'
            }
            onPress={() => router.push('/(tabs)/chat')}
            style={({ pressed }) => [styles.headerIconWrap, pressed && styles.bellPressed]}
          >
            <SymbolView
              name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'chat', web: 'chat' }}
              tintColor="#FFFFFF"
              size={22}
            />
            {chatUnreadCount > 0 ? (
              <View style={styles.badge} pointerEvents="none">
                <Text style={styles.badgeText}>
                  {chatUnreadCount > 99 ? '99+' : String(chatUnreadCount)}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityLabel={
              unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications, no unread'
            }
            onPress={() => setModalOpen(true)}
            style={({ pressed }) => [styles.headerIconWrap, pressed && styles.bellPressed]}
          >
            <SymbolView
              name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              tintColor="#FFFFFF"
              size={22}
            />
            {unreadCount > 0 ? (
              <View style={styles.badge} pointerEvents="none">
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: Math.max(16, insets.bottom + 8) }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <View style={styles.modalHeaderActions}>
                {items.some((i) => !i.read) ? (
                  <TouchableOpacity onPress={markAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.markAll}>Mark all read</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.close}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
            {items.length === 0 ? (
              <Text style={styles.empty}>No notifications yet.</Text>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(it) => it.id}
                renderItem={renderRow}
                style={styles.list}
                contentContainerStyle={styles.listContent}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
