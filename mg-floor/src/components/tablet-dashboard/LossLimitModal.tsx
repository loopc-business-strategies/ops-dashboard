import React, { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { tabletDashboard as td } from '@/src/theme'
import { parseLossLimit } from './statsFormat'

type Props = {
  visible: boolean
  department: string
  current: number | null
  /** Resolves to an error message, or null once saved. */
  onSave: (lossLimitPct: number | null) => Promise<string | null>
  onClose: () => void
}

/** Floor / Production Managers set the % of Metal In above which a batch's loss shows red. */
export function LossLimitModal({ visible, department, current, onSave, onClose }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!visible) return
    setText(current == null ? '' : String(current))
    setError(null)
    setBusy(false)
  }, [visible, current])

  const save = async (value: number | null) => {
    setBusy(true)
    const err = await onSave(value)
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  const onSubmit = () => {
    const value = parseLossLimit(text)
    if (value == null) return setError('Enter a limit, e.g. 0.5')
    if (Number.isNaN(value)) return setError('Enter a % between 0 and 100, e.g. 0.5')
    save(value)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <View style={styles.card}>
          <Text style={styles.title}>Metal loss limit</Text>
          <Text style={styles.help}>
            Loss above this % of Metal In shows in red{department ? ` for ${department}` : ''}.
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="Loss limit percent"
              value={text}
              onChangeText={(v) => {
                setText(v)
                setError(null)
              }}
              keyboardType="decimal-pad"
              placeholder="e.g. 0.5"
              placeholderTextColor={td.textMuted}
              style={styles.input}
              editable={!busy}
              autoFocus
            />
            <Text style={styles.pct}>%</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={onSubmit}
            disabled={busy}
            style={({ pressed }) => [styles.save, (pressed || busy) && { opacity: 0.8 }]}
          >
            <Text style={styles.saveText}>{busy ? 'SAVING…' : 'SAVE LIMIT'}</Text>
          </Pressable>
          <View style={styles.footer}>
            {current != null ? (
              <Pressable accessibilityRole="button" onPress={() => save(null)} disabled={busy}>
                <Text style={styles.link}>Remove limit</Text>
              </Pressable>
            ) : <View />}
            <Pressable accessibilityRole="button" onPress={onClose} disabled={busy}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 380, backgroundColor: td.white, borderRadius: 8, padding: 16, gap: 10 },
  title: { color: td.text, fontWeight: '800', fontSize: 17 },
  help: { color: td.textMuted, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '700',
    color: td.text,
  },
  pct: { color: td.text, fontSize: 18, fontWeight: '700' },
  error: { color: '#B91C1C', fontSize: 13 },
  save: { height: 44, borderRadius: td.radius, backgroundColor: td.orange, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: td.white, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: td.orange, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' },
  cancel: { color: td.textMuted, fontWeight: '700', fontSize: 13 },
})
