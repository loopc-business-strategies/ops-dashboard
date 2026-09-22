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
import { listDepartments, listJobs, metalOut } from '@/src/api/factory'
import { userFacingMessage } from '@/src/api/errors'
import { colors, spacing } from '@/src/theme'

type BatchRow = {
  _id: string
  batchNumber?: string
  currentWeight?: number
  currentDepartment?: string
  status?: string
  metalType?: string
}

type DeptRow = { key: string; label: string }

export default function MetalOutScreen() {
  const { employeeToken, department } = useAuth()
  const tablet = useIsTablet()
  const [loading, setLoading] = useState(true)
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [departments, setDepartments] = useState<DeptRow[]>([])
  const [selected, setSelected] = useState<BatchRow | null>(null)
  const [toDepartment, setToDepartment] = useState('')
  const [weight, setWeight] = useState('')
  const [purpose, setPurpose] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!employeeToken) return
    setLoading(true)
    try {
      const [jobs, depts] = await Promise.all([listJobs(employeeToken), listDepartments(employeeToken)])
      setBatches((jobs.batches || []) as BatchRow[])
      setDepartments((depts.departments || []).filter((d) => d.key !== department?.key))
    } catch (err) {
      Alert.alert('Load failed', userFacingMessage(err))
    } finally {
      setLoading(false)
    }
  }, [employeeToken, department?.key])

  useEffect(() => {
    load()
  }, [load])

  const onConfirm = async () => {
    if (!employeeToken || !selected) {
      Alert.alert('Select a batch', 'Choose a batch currently in this department')
      return
    }
    const w = Number(weight)
    if (!toDepartment.trim()) {
      Alert.alert('Destination required', 'Select a destination department')
      return
    }
    if (!Number.isFinite(w) || w <= 0) {
      Alert.alert('Weight required', 'Enter a positive weight in grams')
      return
    }
    setBusy(true)
    try {
      await metalOut(employeeToken, {
        batchId: String(selected._id),
        toDepartment: toDepartment.trim(),
        weight: w,
        purpose: purpose.trim() || 'MG Factory Metal OUT',
        operationId: `mgf-out-${selected._id}-${Date.now()}`,
      })
      Alert.alert('Metal OUT recorded', `${w} g → ${toDepartment}`)
      setSelected(null)
      setWeight('')
      setToDepartment('')
      setPurpose('')
      await load()
    } catch (err) {
      Alert.alert('Metal OUT failed', userFacingMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingBlock label="Loading batches…" />
      </Screen>
    )
  }

  const list = (
    <>
      <Text style={styles.section}>Batches here</Text>
      <FlatList
        data={batches}
        keyExtractor={(item) => String(item._id)}
        style={[styles.list, tablet && styles.listTablet]}
        contentContainerStyle={tablet ? styles.listContent : undefined}
        ListEmptyComponent={<Text style={styles.empty}>No batches in this department</Text>}
        renderItem={({ item }) => {
          const active = selected?._id === item._id
          return (
            <Pressable
              onPress={() => {
                setSelected(item)
                if (item.currentWeight != null) setWeight(String(item.currentWeight))
              }}
              style={[styles.row, active && styles.rowActive]}
            >
              <Text style={styles.rowTitle}>{item.batchNumber || item._id}</Text>
              <Text style={styles.rowMeta}>
                {item.metalType || 'Metal'} · {item.currentWeight != null ? `${item.currentWeight} g` : '—'} ·{' '}
                {item.status || ''}
              </Text>
            </Pressable>
          )
        }}
      />
    </>
  )

  const form = (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formScroll}>
      <Text style={styles.section}>Destination</Text>
      <View style={styles.deptWrap}>
        {departments.map((d) => {
          const active = toDepartment === d.key
          return (
            <Pressable
              key={d.key}
              onPress={() => setToDepartment(d.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <Text style={styles.label}>Weight (g)</Text>
      <TextInput
        style={styles.input}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.label}>Purpose</Text>
      <TextInput
        style={styles.input}
        value={purpose}
        onChangeText={setPurpose}
        placeholder="Optional"
        placeholderTextColor={colors.textMuted}
      />
      <BigButton label={busy ? 'SAVING…' : 'CONFIRM METAL OUT'} onPress={onConfirm} disabled={busy} />
    </ScrollView>
  )

  return (
    <Screen style={styles.screen}>
      <Title>METAL OUT</Title>
      <Subtitle>{department?.label || 'Department'} — send metal to next department</Subtitle>

      {tablet ? (
        <View style={styles.columns}>
          <View style={styles.colLeft}>{list}</View>
          <View style={styles.colRight}>{form}</View>
        </View>
      ) : (
        <>
          {list}
          {form}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { paddingBottom: spacing.xl },
  columns: { flex: 1, flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  colLeft: { flex: 1, minWidth: 0 },
  colRight: { flex: 1, minWidth: 0 },
  section: { color: colors.text, fontWeight: '800', marginTop: spacing.md },
  list: { maxHeight: 180, marginTop: spacing.sm },
  listTablet: { maxHeight: undefined, flex: 1, marginTop: spacing.sm },
  listContent: { paddingBottom: spacing.md },
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
  deptWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  chipText: { color: colors.textMuted, fontWeight: '700' },
  chipTextActive: { color: colors.accent },
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
