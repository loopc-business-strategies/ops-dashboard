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
import { listJobs, metalIn } from '@/src/api/factory'
import { userFacingMessage } from '@/src/api/errors'
import { colors, spacing } from '@/src/theme'

type PassRow = {
  _id: string
  passNumber?: string
  batchNumber?: string
  weight?: number
  fromDepartment?: string
  toDepartment?: string
  status?: string
}

/** Alloy IN reuses Metal IN receive-pass API with Alloy purpose labeling. */
export default function AlloyInScreen() {
  const { employeeToken, department, user } = useAuth()
  const tablet = useIsTablet()
  const [loading, setLoading] = useState(true)
  const [passes, setPasses] = useState<PassRow[]>([])
  const [selected, setSelected] = useState<PassRow | null>(null)
  const [weight, setWeight] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [passIdManual, setPassIdManual] = useState('')
  const operatorName = user?.name?.trim() || ''

  const load = useCallback(async () => {
    if (!employeeToken) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await listJobs(employeeToken)
      setPasses((data.inboundPasses || []) as PassRow[])
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
    const passId = selected?._id || passIdManual.trim()
    const w = Number(weight)
    if (!passId) {
      Alert.alert('Select a pass', 'Choose an inbound pass or enter a pass id')
      return
    }
    if (!Number.isFinite(w) || w <= 0) {
      Alert.alert('Weight required', 'Enter a positive received weight in grams')
      return
    }
    setBusy(true)
    try {
      const stamp = `Confirmed by ${operatorName}`
      await metalIn(employeeToken, {
        passId,
        receivedWeight: w,
        varianceReason: reason.trim()
          ? `Alloy IN — ${reason.trim()} — ${stamp}`
          : `Alloy IN — ${stamp}`,
        operationId: `mgf-alloy-in-${passId}-${Date.now()}`,
      })
      Alert.alert('Alloy IN recorded', `${w} g received\n${stamp}`)
      setSelected(null)
      setWeight('')
      setReason('')
      setPassIdManual('')
      await load()
    } catch (err) {
      Alert.alert('Alloy IN failed', userFacingMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!employeeToken) {
    return (
      <Screen>
        <Title>ALLOY IN</Title>
        <Subtitle>Sign in as employee on Home to continue</Subtitle>
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        <LoadingBlock label="Loading inbound passes…" />
      </Screen>
    )
  }

  const list = (
    <FlatList
      data={passes}
      keyExtractor={(item) => String(item._id)}
      style={[styles.list, tablet && styles.listTablet]}
      contentContainerStyle={tablet ? styles.listContent : undefined}
      ListEmptyComponent={<Text style={styles.empty}>No inbound passes for this department</Text>}
      renderItem={({ item }) => {
        const active = selected?._id === item._id
        return (
          <Pressable
            onPress={() => {
              setSelected(item)
              setPassIdManual(String(item.passNumber || item._id))
              if (item.weight != null) setWeight(String(item.weight))
            }}
            style={[styles.row, active && styles.rowActive]}
          >
            <Text style={styles.rowTitle}>{item.passNumber || item._id}</Text>
            <Text style={styles.rowMeta}>
              {item.batchNumber || '—'} · {item.fromDepartment || '?'} → {item.toDepartment || '?'} ·{' '}
              {item.weight != null ? `${item.weight} g` : '—'}
            </Text>
          </Pressable>
        )
      }}
    />
  )

  const form = (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formScroll}>
      <Text style={styles.label}>Pass ID or pass number</Text>
      <TextInput
        style={styles.input}
        value={passIdManual}
        onChangeText={setPassIdManual}
        autoCapitalize="none"
        placeholder="Pass number or Mongo id"
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.label}>Received weight (g)</Text>
      <TextInput
        style={styles.input}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.label}>Notes / variance reason</Text>
      <TextInput
        style={styles.input}
        value={reason}
        onChangeText={setReason}
        placeholder="Optional"
        placeholderTextColor={colors.textMuted}
      />
      <BigButton
        label={
          busy
            ? 'SAVING…'
            : operatorName
              ? `CONFIRM ALLOY IN — ${operatorName}`
              : 'CONFIRM — Sign in required'
        }
        onPress={onConfirm}
        disabled={busy || !operatorName}
        tone="success"
      />
    </ScrollView>
  )

  return (
    <Screen style={styles.screen}>
      <Title>ALLOY IN</Title>
      <Subtitle>{department?.label || 'Department'} — receive alloy pass</Subtitle>
      {tablet ? (
        <View style={styles.columns}>
          <View style={styles.colLeft}>
            <Text style={styles.section}>Inbound passes</Text>
            {list}
          </View>
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
  section: { color: colors.text, fontWeight: '800', marginBottom: spacing.sm },
  list: { maxHeight: 220, marginTop: spacing.md },
  listTablet: { maxHeight: undefined, flex: 1, marginTop: 0 },
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
