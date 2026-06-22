import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { RoleBadge } from '@/src/components/admin/RoleBadge'
import { DEPTS, ROLES } from '@/src/constants/admin'
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import { useTenantSessionKey } from '@/src/hooks/useTenantSessionKey'
import {
  deleteUser,
  fetchUsers,
  getUserId,
  toggleUser,
  type AdminUser,
} from '@/src/api/users'

export default function AdminUsersScreen() {
  const { token, user: me } = useAuth()
  const sessionReady = useTenantSessionReady()
  const tenantSessionKey = useTenantSessionKey()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [error, setError] = useState('')

  const load = useCallback(async (isRefresh = false) => {
    if (!token || !sessionReady) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const list = await fetchUsers(token)
      setUsers(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, sessionReady])

  useEffect(() => {
    setUsers([])
    setError('')
    setLoading(true)
  }, [tenantSessionKey])

  useFocusEffect(
    useCallback(() => {
      load(false)
    }, [load]),
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (!q) return true
      return [u.name, u.fullName, u.title, u.employeeCode].some((v) =>
        String(v || '').toLowerCase().includes(q),
      )
    })
  }, [users, query, roleFilter])

  const onToggle = (u: AdminUser) => {
    const id = getUserId(u)
    if (id === me?.id) {
      Alert.alert('Not allowed', 'You cannot deactivate your own account.')
      return
    }
    Alert.alert(
      u.isActive === false ? 'Activate user?' : 'Deactivate user?',
      `@${u.name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await toggleUser(token!, id)
              load(true)
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Toggle failed')
            }
          },
        },
      ],
    )
  }

  const onDelete = (u: AdminUser) => {
    const id = getUserId(u)
    if (id === me?.id) {
      Alert.alert('Not allowed', 'You cannot delete your own account.')
      return
    }
    Alert.alert('Delete user?', `@${u.name} will be deactivated and removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUser(token!, id, `Removed via ${mgBranding.appName} mobile admin`)
            load(true)
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed')
          }
        },
      },
    ])
  }

  if (loading && !users.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={mgBranding.colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search users…"
          placeholderTextColor="#9CA3AF"
          style={styles.search}
        />
        <View style={styles.filterRow}>
          {['all', ...ROLES.map((r) => r.value)].slice(0, 4).map((role) => (
            <Pressable
              key={role}
              onPress={() => setRoleFilter(role)}
              style={[styles.filterChip, roleFilter === role && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, roleFilter === role && styles.filterTextActive]}>
                {role === 'all' ? 'All' : ROLES.find((r) => r.value === role)?.label.split(' ')[0] || role}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.createBtn} onPress={() => router.push('/admin-settings/create')}>
          <Text style={styles.createBtnText}>+ Create user</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => getUserId(item)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
        renderItem={({ item }) => {
          const id = getUserId(item)
          const deptLabel = DEPTS.find((d) => d.value === item.department)?.label || item.department || '—'
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.fullName || item.name}</Text>
                  <Text style={styles.username}>@{item.name}</Text>
                </View>
                <RoleBadge role={item.role} />
              </View>
              <Text style={styles.meta}>{deptLabel} · {item.isActive === false ? 'Inactive' : 'Active'}</Text>
              <View style={styles.actions}>
                <Pressable style={styles.actionBtn} onPress={() => router.push(`/admin-settings/edit/${id}`)}>
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => router.push(`/admin-settings/permissions/${id}`)}>
                  <Text style={styles.actionText}>Permissions</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => onToggle(item)}>
                  <Text style={styles.actionText}>{item.isActive === false ? 'Activate' : 'Deactivate'}</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.dangerBtn]} onPress={() => onDelete(item)}>
                  <Text style={[styles.actionText, styles.dangerText]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toolbar: { padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  search: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#F8FAFC',
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  filterChipActive: { borderColor: mgBranding.colors.primary, backgroundColor: '#EFF6FF' },
  filterText: { fontSize: 12, color: mgBranding.colors.muted },
  filterTextActive: { color: mgBranding.colors.primary, fontWeight: '700' },
  createBtn: {
    backgroundColor: mgBranding.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: mgBranding.colors.danger, paddingHorizontal: 16, paddingTop: 8 },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  empty: { textAlign: 'center', color: mgBranding.colors.muted, marginTop: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { fontSize: 16, fontWeight: '800', color: mgBranding.colors.text },
  username: { fontSize: 13, color: mgBranding.colors.muted, marginTop: 2 },
  meta: { fontSize: 12, color: mgBranding.colors.muted, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
  },
  actionBtnDanger: {},
  dangerBtn: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  actionText: { fontSize: 12, fontWeight: '700', color: mgBranding.colors.primary },
  dangerText: { color: mgBranding.colors.danger },
})
