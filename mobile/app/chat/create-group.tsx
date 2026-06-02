import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, router } from 'expo-router'
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'
import { useChat } from '@/src/context/ChatContext'

export default function CreateGroupScreen() {
  const { user } = useAuth()
  const { participants, createGroup } = useChat()
  const [name, setName] = useState('')
  const [dept, setDept] = useState(user?.department || 'All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase()
    return participants
      .filter((p) => p.id !== String(user?.id || ''))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || String(p.dept || '').toLowerCase().includes(q))
  }, [participants, search, user?.id])

  const toggleMember = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const onCreate = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    setError('')
    try {
      const group = await createGroup({ name: name.trim(), dept: dept.trim() || 'All', memberIds: selected })
      router.replace({ pathname: '/chat/[chatId]' as never, params: { chatId: group.id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Create group' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Group name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Production Team" />

        <Text style={styles.label}>Department</Text>
        <TextInput style={styles.input} value={dept} onChangeText={setDept} placeholder="Production" />

        <Text style={styles.label}>Add members</Text>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Search team…"
        />

        <FlatList
          data={roster}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const active = selected.includes(item.id)
            return (
              <Pressable style={styles.memberRow} onPress={() => toggleMember(item.id)}>
                <View style={[styles.avatar, { backgroundColor: item.color }]}>
                  <Text style={styles.avatarText}>{item.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{item.name}</Text>
                  <Text style={styles.memberDept}>{item.dept || 'Team'}</Text>
                </View>
                <View style={[styles.check, active && styles.checkActive]}>
                  {active ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
              </Pressable>
            )
          }}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.createBtn, (!name.trim() || creating) && styles.createBtnDisabled]}
          onPress={onCreate}
          disabled={!name.trim() || creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createText}>Create group</Text>
          )}
        </Pressable>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 12, fontWeight: '800', color: mgBranding.colors.muted, marginBottom: 6, marginTop: 12, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: mgBranding.colors.text,
    backgroundColor: '#fff',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  memberName: { fontWeight: '700', color: mgBranding.colors.text, fontSize: 15 },
  memberDept: { color: mgBranding.colors.muted, fontSize: 12, marginTop: 2 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: { backgroundColor: mgBranding.colors.success, borderColor: mgBranding.colors.success },
  checkMark: { color: '#fff', fontWeight: '800', fontSize: 12 },
  createBtn: {
    marginTop: 20,
    backgroundColor: mgBranding.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.5 },
  createText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  error: { color: mgBranding.colors.danger, marginTop: 12, fontSize: 13 },
})
