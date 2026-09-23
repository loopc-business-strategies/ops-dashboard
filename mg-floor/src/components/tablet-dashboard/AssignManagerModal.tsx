import React, { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native'
import { tabletDashboard as td } from '@/src/theme'
import {
  addManagerOption,
  getManagerOptions,
  setAssignedManager,
  type AssignedManager,
} from '@/src/auth/floorDashboardPrefs'

type Props = {
  visible: boolean
  onClose: () => void
  onAssigned: (manager: AssignedManager) => void
}

export function AssignManagerModal({ visible, onClose, onAssigned }: Props) {
  const [options, setOptions] = useState<AssignedManager[]>([])
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!visible) return
    getManagerOptions().then(setOptions)
  }, [visible])

  const pick = async (manager: AssignedManager) => {
    if (busy) return
    setBusy(true)
    try {
      await setAssignedManager(manager)
      onAssigned(manager)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const addCustom = async () => {
    if (!custom.trim() || busy) return
    setBusy(true)
    try {
      const manager = await addManagerOption(custom)
      setOptions(await getManagerOptions())
      await setAssignedManager(manager)
      onAssigned(manager)
      setCustom('')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Assign Manager</Text>
          <ScrollView style={styles.list}>
            {options.map((m) => (
              <Pressable key={m.id} style={styles.option} onPress={() => pick(m)}>
                <Text style={styles.optionText}>{m.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.label}>Add name</Text>
          <TextInput
            style={styles.input}
            value={custom}
            onChangeText={setCustom}
            placeholder="Manager name"
            placeholderTextColor={td.textMuted}
          />
          <Pressable
            style={[styles.confirm, (!custom.trim() || busy) && styles.disabled]}
            onPress={addCustom}
            disabled={!custom.trim() || busy}
          >
            <Text style={styles.confirmText}>{busy ? 'Saving…' : 'Confirm'}</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: td.white,
    borderRadius: td.radius,
    borderWidth: 1,
    borderColor: td.border,
    padding: 16,
    maxHeight: '80%',
    zIndex: 1,
  },
  title: { color: td.text, fontWeight: '800', fontSize: 18, marginBottom: 12 },
  list: { maxHeight: 220, marginBottom: 12 },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: td.borderGrid,
  },
  optionText: { color: td.text, fontWeight: '700', fontSize: 16 },
  label: { color: td.textMuted, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: td.text,
    fontWeight: '600',
    marginBottom: 12,
  },
  confirm: {
    backgroundColor: td.orange,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: td.radius,
    marginBottom: 8,
  },
  confirmText: { color: td.white, fontWeight: '800', fontSize: 16 },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
  },
  cancelText: { color: td.text, fontWeight: '700' },
  disabled: { opacity: 0.45 },
})
