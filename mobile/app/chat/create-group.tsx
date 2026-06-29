import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, router } from 'expo-router'
import { useAuth } from '@/src/context/AuthContext'
import { useChat } from '@/src/context/ChatContext'
import { useBrandingStyles } from '@/src/hooks/useBrandingStyles'
import { createCreateGroupStyles } from '@/src/styles/adminFormScreenStyles'

export default function CreateGroupScreen() {
  const styles = useBrandingStyles(createCreateGroupStyles)
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
