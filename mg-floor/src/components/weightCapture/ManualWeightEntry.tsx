import React, { useState } from 'react'
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native'
import { BigButton } from '@/src/components/ui'
import {
  checkWeightAgainstScale,
  decimalsForResolution,
  type ScaleWeighProfile,
} from '@/src/scaleCamera/cameraSettings'
import { colors, spacing } from '@/src/theme'

type Props = {
  profile: ScaleWeighProfile
  saving?: boolean
  onSubmit: (entry: { weight: number; reason: string; reviewAcknowledged: boolean }) => Promise<boolean>
}

/** Permission-gated manual fallback — recorded as captureMethod MANUAL with the operator's reason. */
export function ManualWeightEntry({ profile, saving, onSubmit }: Props) {
  const [weightText, setWeightText] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    if (saving) return
    const text = weightText.trim()
    const decimals = decimalsForResolution(profile.resolution)
    const pattern = decimals == null ? /^\d+(\.\d+)?$/ : decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`)
    if (!pattern.test(text)) {
      setError(`Enter a weight like ${decimals ? `12.${'5'.padEnd(decimals, '0')}` : '12'} ${profile.unit}`)
      return
    }
    const weight = Number(text)
    const check = checkWeightAgainstScale(weight, profile)
    if (check.status === 'INVALID' || check.status === 'OUT_OF_RANGE') {
      setError(check.message)
      return
    }
    if (reason.trim().length < 3) {
      setError('A reason is required for manual weight entry')
      return
    }
    setError('')
    const send = async (reviewAcknowledged: boolean) => {
      const ok = await onSubmit({ weight, reason: reason.trim(), reviewAcknowledged })
      if (ok) {
        setWeightText('')
        setReason('')
      }
    }
    if (check.status === 'REVIEW') {
      Alert.alert('Above scale capacity', `${check.message}. Record this weight anyway?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'I have reviewed it', onPress: () => void send(true) },
      ])
      return
    }
    await send(false)
  }

  return (
    <View style={styles.block}>
      <Text style={styles.warn}>
        Manual entry is recorded as MANUAL with your name, device and reason. Use only when the scale cannot be read.
      </Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.weightInput]}
          keyboardType="decimal-pad"
          value={weightText}
          onChangeText={setWeightText}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          editable={!saving}
        />
        <Text style={styles.unit}>{profile.unit}</Text>
      </View>
      <TextInput
        style={styles.input}
        value={reason}
        onChangeText={setReason}
        placeholder="Reason (e.g. scale display damaged)"
        placeholderTextColor={colors.textMuted}
        editable={!saving}
        maxLength={500}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <BigButton label={saving ? 'SAVING…' : 'SAVE MANUAL WEIGHT'} onPress={submit} disabled={saving} />
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  warn: { color: colors.warning, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  weightInput: { flex: 1, fontSize: 22, fontWeight: '700' },
  unit: { color: colors.textMuted, fontWeight: '700', fontSize: 18 },
  err: { color: colors.danger },
})
