import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, LoadingBlock, Screen, Subtitle, Title, useIsTablet } from '@/src/components/ui'
import { listJobs, setPurity } from '@/src/api/factory'
import { userFacingMessage } from '@/src/api/errors'
import { colors, spacing } from '@/src/theme'

type BatchRow = {
  _id: string
  batchNumber?: string
  currentWeight?: number
  purity?: string
  metalType?: string
  status?: string
}

export default function PurityScreen() {
  const { employeeToken, department, user } = useAuth()
  const tablet = useIsTablet()
  const [loading, setLoading] = useState(true)
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [selected, setSelected] = useState<BatchRow | null>(null)
  const [batchIdManual, setBatchIdManual] = useState('')
  const [purity, setPurityValue] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const operatorName = user?.name?.trim() || ''

  const load = useCallback(async () => {
    if (!employeeToken) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await listJobs(employeeToken)
      setBatches((data.batches || []) as BatchRow[])
    } catch (err) {
      Alert.alert('Load failed', userFacingMessage(err))
    } finally {
      setLoading(false)
    }
  }, [employeeToken])

  useEffect(() => {
    load()
  }, [load])

  const onConfirm = async () => {
    if (!employeeToken || !operatorName) {
      Alert.alert('Sign in required', 'Sign in as employee on Home first')
      return
    }
    const batchId = selected?._id ? String(selected._id) : batchIdManual.trim()
    if (!batchId) {
      Alert.alert('Select a batch', 'Choose a batch or enter a batch number')
      return
    }
    if (!purity.trim()) {
      Alert.alert('Purity required', 'Enter purity (e.g. 22K, 916, 999)')
      return
    }
    setBusy(true)
    try {
      const res = await setPurity(employeeToken, {
        batchId,
        purity: purity.trim(),
        notes: notes.trim() || undefined,
      })
      Alert.alert(
        'Purity saved',
        `${purity.trim()}\nConfirmed by ${res.confirmedBy || operatorName}`,
      )
      setSelected(null)
      setBatchIdManual('')
      setPurityValue('')
      setNotes('')
      await load()
    } catch (err) {
      Alert.alert('Purity failed', userFacingMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!employeeToken) {
    return (
      <Screen>
        <Title>PURITY</Title>
        <Subtitle>Sign in as employee on Home to continue</Subtitle>
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        <LoadingBlock label="Loading batches…" />
      </Screen>
    )
  }

  return (
    <Screen style={styles.screen}>
      <Title>PURITY</Title>
      <Subtitle>{department?.label || 'Department'} — set batch purity</Subtitle>
      <View style={tablet ? styles.columns : undefined}>
        <FlatList
          data={batches}
          keyExtractor={(item) => String(item._id)}
          style={[styles.list, tablet && styles.listTablet]}
          ListEmptyComponent={<Text style={styles.empty}>No batches here</Text>}
          renderItem={({ item }) => {
            const active = selected?._id === item._id
            return (
              <Pressable
                onPress={() => {
                  setSelected(item)
                  setBatchIdManual(String(item.batchNumber || item._id))
                  if (item.purity) setPurityValue(String(item.purity))
                }}
                style={[styles.row, active && styles.rowActive]}
              >
                <Text style={styles.rowTitle}>{item.batchNumber || item._id}</Text>
                <Text style={styles.rowMeta}>
                  {item.metalType || 'Metal'} · purity {item.purity || '—'} · {item.status || ''}
                </Text>
              </Pressable>
            )
          }}
        />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formScroll}>
          <Text style={styles.label}>Batch ID / number</Text>
          <TextInput
            style={styles.input}
            value={batchIdManual}
            onChangeText={setBatchIdManual}
            autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
            placeholder="Batch number"
          />
          <Text style={styles.label}>Purity</Text>
          <TextInput
            style={styles.input}
            value={purity}
            onChangeText={setPurityValue}
            autoCapitalize="characters"
            placeholder="e.g. 22K"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional"
            placeholderTextColor={colors.textMuted}
          />
          <BigButton
            label={
              busy
                ? 'SAVING…'
                : operatorName
                  ? `CONFIRM PURITY — ${operatorName}`
                  : 'CONFIRM — Sign in required'
            }
            onPress={onConfirm}
            disabled={busy || !operatorName}
            tone="success"
          />
        </ScrollView>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { paddingBottom: spacing.xl },
  columns: { flex: 1, flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  list: { maxHeight: 200, marginTop: spacing.md },
  listTablet: { maxHeight: undefined, flex: 1 },
  formScroll: { paddingBottom: spacing.lg, flexGrow: 1 },
  empty: { color: colors.textMuted, marginVertical: spacing.md },
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowActive: { borderColor: colors.accent },
  rowTitle: { color: colors.text, fontWeight: '800' },
  rowMeta: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
  label: { color: colors.textMuted, marginTop: spacing.md, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
})
