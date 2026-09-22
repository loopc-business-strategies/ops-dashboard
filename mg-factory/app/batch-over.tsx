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
import { batchComplete, listJobs } from '@/src/api/factory'
import { userFacingMessage } from '@/src/api/errors'
import { colors, spacing } from '@/src/theme'

type RunRow = {
  _id: string
  processNumber?: string
  batchNumber?: string
  process?: string
  inputWeight?: number
  status?: string
}

export default function BatchOverScreen() {
  const { employeeToken, department, user } = useAuth()
  const tablet = useIsTablet()
  const [loading, setLoading] = useState(true)
  const [runs, setRuns] = useState<RunRow[]>([])
  const [selected, setSelected] = useState<RunRow | null>(null)
  const [runIdManual, setRunIdManual] = useState('')
  const [outputWeight, setOutputWeight] = useState('')
  const [scrap, setScrap] = useState('0')
  const [loss, setLoss] = useState('0')
  const [remarks, setRemarks] = useState('')
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
      setRuns((data.activeRuns || []) as RunRow[])
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
    const processRunId = selected?._id ? String(selected._id) : runIdManual.trim()
    if (!processRunId) {
      Alert.alert('Select a run', 'Choose an in-progress process or enter its id')
      return
    }
    const ow = Number(outputWeight)
    if (!Number.isFinite(ow) || ow < 0) {
      Alert.alert('Output weight required', 'Enter output weight in grams')
      return
    }
    setBusy(true)
    try {
      const res = await batchComplete(employeeToken, {
        processRunId,
        outputWeight: ow,
        scrap: Number(scrap) || 0,
        loss: Number(loss) || 0,
        remarks: remarks.trim() || undefined,
        operationId: `mgf-over-${processRunId}-${Date.now()}`,
      })
      Alert.alert(
        'Batch over',
        `Process completed\nConfirmed by ${res.confirmedBy || operatorName}`,
      )
      setSelected(null)
      setRunIdManual('')
      setOutputWeight('')
      setScrap('0')
      setLoss('0')
      setRemarks('')
      await load()
    } catch (err) {
      Alert.alert('Batch over failed', userFacingMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!employeeToken) {
    return (
      <Screen>
        <Title>BATCH OVER</Title>
        <Subtitle>Sign in as employee on Home to continue</Subtitle>
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        <LoadingBlock label="Loading active processes…" />
      </Screen>
    )
  }

  return (
    <Screen style={styles.screen}>
      <Title>BATCH OVER</Title>
      <Subtitle>{department?.label || 'Department'} — complete process</Subtitle>
      <View style={tablet ? styles.columns : undefined}>
        <FlatList
          data={runs}
          keyExtractor={(item) => String(item._id)}
          style={[styles.list, tablet && styles.listTablet]}
          ListEmptyComponent={<Text style={styles.empty}>No in-progress processes</Text>}
          renderItem={({ item }) => {
            const active = selected?._id === item._id
            return (
              <Pressable
                onPress={() => {
                  setSelected(item)
                  setRunIdManual(String(item._id))
                  if (item.inputWeight != null) setOutputWeight(String(item.inputWeight))
                }}
                style={[styles.row, active && styles.rowActive]}
              >
                <Text style={styles.rowTitle}>{item.processNumber || item._id}</Text>
                <Text style={styles.rowMeta}>
                  {item.batchNumber || '—'} · {item.process || 'Process'} · in{' '}
                  {item.inputWeight != null ? `${item.inputWeight} g` : '—'}
                </Text>
              </Pressable>
            )
          }}
        />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formScroll}>
          <Text style={styles.label}>Process run ID</Text>
          <TextInput
            style={styles.input}
            value={runIdManual}
            onChangeText={setRunIdManual}
            autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
            placeholder="Select from list or paste id"
          />
          <Text style={styles.label}>Output weight (g)</Text>
          <TextInput
            style={styles.input}
            value={outputWeight}
            onChangeText={setOutputWeight}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Scrap (g)</Text>
          <TextInput
            style={styles.input}
            value={scrap}
            onChangeText={setScrap}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Loss (g)</Text>
          <TextInput
            style={styles.input}
            value={loss}
            onChangeText={setLoss}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Remarks</Text>
          <TextInput
            style={styles.input}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Optional"
            placeholderTextColor={colors.textMuted}
          />
          <BigButton
            label={
              busy
                ? 'COMPLETING…'
                : operatorName
                  ? `CONFIRM OVER — ${operatorName}`
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
  formScroll: { paddingBottom: spacing.lg },
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
