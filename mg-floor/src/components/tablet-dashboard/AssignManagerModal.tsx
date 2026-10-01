import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'
import { fetchManagerOptions, type ManagerOption } from '@/src/api/departmentManagers'
import { toApiError } from '@/src/api/errors'
import type { AssignedManager } from '@/src/auth/floorDashboardPrefs'

type Props = {
  visible: boolean
  onClose: () => void
  department: string
  current: AssignedManager | null
  /** Only Floor / Production Managers may change it. */
  canAssign: boolean
  /** Resolves to an error message, or null once saved. */
  onAssign: (managerId: string | null) => Promise<string | null>
}

const ROLE_LABEL: Record<ManagerOption['productionRole'], string> = {
  floor_manager: 'Floor Manager',
  production_manager: 'Production Manager',
}

export function AssignManagerModal({ visible, onClose, department, current, canAssign, onAssign }: Props) {
  const [options, setOptions] = useState<ManagerOption[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!visible) return
    setError('')
    if (!canAssign) return
    let cancelled = false
    setOptions(null)
    fetchManagerOptions()
      .then((res) => !cancelled && setOptions(res.managers))
      .catch((err) => {
        if (cancelled) return
        setOptions([])
        setError(toApiError(err).message || 'Could not load managers')
      })
    return () => {
      cancelled = true
    }
  }, [visible, canAssign])

  const save = async (managerId: string | null) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const failed = await onAssign(managerId)
      if (failed) setError(failed)
      else onClose()
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
          <Text style={styles.meta}>Department: {department || '—'}</Text>
          <Text style={styles.meta}>Manager: {current?.name || 'Not assigned'}</Text>

          {canAssign ? (
            <>
              <Text style={styles.label}>Pick the manager in charge — every tablet in this department shows it.</Text>
              {options == null ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={td.orange} />
                  <Text style={styles.muted}>Loading managers…</Text>
                </View>
              ) : options.length === 0 && !error ? (
                <Text style={styles.muted}>
                  No Floor or Production Manager accounts yet. Ask an admin to give someone that role.
                </Text>
              ) : (
                <ScrollView style={styles.list}>
                  {options.map((m) => {
                    const active = m.id === current?.id
                    return (
                      <Pressable
                        key={m.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active, disabled: busy }}
                        disabled={busy}
                        style={[styles.option, active && styles.optionActive]}
                        onPress={() => (active ? onClose() : save(m.id))}
                      >
                        <Text style={styles.optionText}>{m.name}</Text>
                        <Text style={styles.optionRole}>{active ? '✓ Assigned' : ROLE_LABEL[m.productionRole] || ''}</Text>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              )}
              {current ? (
                <Pressable
                  accessibilityRole="button"
                  style={[styles.remove, busy && styles.disabled]}
                  disabled={busy}
                  onPress={() => save(null)}
                >
                  <Text style={styles.removeText}>Remove manager</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={styles.notice}>
              Only a Floor or Production Manager can change this. Ask one to log in on this tablet.
            </Text>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {busy ? <Text style={styles.muted}>Saving…</Text> : null}

          <Pressable accessibilityRole="button" style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>{canAssign ? 'Cancel' : 'Close'}</Text>
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
    flexShrink: 1,
    zIndex: 1,
    gap: 6,
  },
  title: { color: td.text, fontWeight: '800', fontSize: 18, marginBottom: 6 },
  meta: { color: td.text, fontWeight: '600', fontSize: 15 },
  label: { color: td.textMuted, fontWeight: '600', marginTop: 8 },
  muted: { color: td.textMuted, fontSize: 14 },
  notice: {
    color: td.text,
    fontSize: 14,
    backgroundColor: td.cream,
    borderWidth: 1,
    borderColor: td.orange,
    borderRadius: td.radius,
    padding: 12,
    marginTop: 8,
  },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  list: { maxHeight: 260, flexShrink: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: td.borderGrid,
  },
  optionActive: { backgroundColor: td.cream },
  optionText: { color: td.text, fontWeight: '700', fontSize: 16 },
  optionRole: { color: td.textMuted, fontWeight: '600', fontSize: 13 },
  error: { color: '#DC2626', fontWeight: '600' },
  remove: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: td.orange,
    borderRadius: td.radius,
    marginTop: 8,
  },
  removeText: { color: td.orange, fontWeight: '700' },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
    marginTop: 4,
  },
  cancelText: { color: td.text, fontWeight: '700' },
  disabled: { opacity: 0.45 },
})
