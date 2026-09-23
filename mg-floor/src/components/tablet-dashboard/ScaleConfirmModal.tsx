import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { StableCapturePanel } from '@/src/components/StableCapturePanel'
import { AuthorizedScalePicker } from '@/src/components/AuthorizedScalePicker'
import { fetchJobs, fetchOpenPasses, metalIn, metalOut } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useStableScaleCapture } from '@/src/hooks/useStableScaleCapture'
import { useAuthorizedScaleIds } from '@/src/hooks/useAuthorizedScaleIds'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { useAuth } from '@/src/context/AuthContext'
import { userFacingMessage } from '@/src/api/errors'
import { tabletDashboard as td } from '@/src/theme'
import type { MetalBatchEdit } from './MetalProcessPanel'

type Props = {
  visible: boolean
  kind: 'in' | 'out'
  batches: MetalBatchEdit[]
  onClose: () => void
  onSaved: () => void
}

type PassRow = { _id: string; passNumber?: string; batchNumber?: string }
type JobRow = { _id?: string; batchId?: string; batchNumber?: string; currentDepartment?: string }

function goldAlloyWeights(batches: MetalBatchEdit[]) {
  let gold = 0
  let alloy = 0
  for (const b of batches) {
    for (const line of b.lines) {
      const n = Number(String(line.qty).replace(/[^\d.]/g, ''))
      if (!Number.isFinite(n) || n <= 0) continue
      if (/alloy/i.test(line.metal)) alloy += n
      else gold += n
    }
  }
  return { gold, alloy, total: gold + alloy }
}

export function ScaleConfirmModal({ visible, kind, batches, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [scaleId, setScaleId] = useState('')
  const [passId, setPassId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [toDepartment, setToDepartment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef<string | null>(null)
  const capture = useStableScaleCapture(scaleId)
  const scales = useAuthorizedScaleIds(user?.department)
  const weights = useMemo(() => goldAlloyWeights(batches), [batches])

  useEffect(() => {
    if (!visible) return
    setError('')
    setBusy(false)
    inFlight.current = null
    if (!scaleId && scales.ids[0]) setScaleId(String(scales.ids[0]))
  }, [visible, scales.ids, scaleId])

  const passes = useAsyncResource(
    useCallback(async (signal) => {
      if (kind !== 'in') return [] as PassRow[]
      const res = await fetchOpenPasses(undefined, { signal })
      return (res.passes || []) as PassRow[]
    }, [kind]),
    { cacheKey: `mg-floor:confirm-passes-${kind}`, isEmpty: (d) => !d.length },
  )

  const jobs = useAsyncResource(
    useCallback(async (signal) => {
      if (kind !== 'out') return [] as JobRow[]
      const res = await fetchJobs({ signal })
      const raw = res.jobs
      return (Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { tasks?: unknown[] })?.tasks)
          ? (raw as { tasks: unknown[] }).tasks
          : []) as JobRow[]
    }, [kind]),
    { cacheKey: `mg-floor:confirm-jobs-${kind}`, isEmpty: (d) => !d.length },
  )
  useEffect(() => {
    if (kind === 'in' && !passId && passes.data?.[0]?._id) setPassId(passes.data[0]._id)
    if (kind === 'out' && !batchId && jobs.data?.[0]) {
      const j = jobs.data[0]
      setBatchId(String(j._id || j.batchId || ''))
    }
  }, [kind, passId, batchId, passes.data, jobs.data])

  const submit = async () => {
    if (busy) return
    if (!scaleId) {
      setError('Select a scale')
      return
    }
    if (!capture.captured?.scaleReadingId) {
      setError('Capture a stable scale reading first')
      return
    }
    if (kind === 'in' && !passId) {
      setError('Select an open pass')
      return
    }
    if (kind === 'out' && (!batchId || !toDepartment.trim())) {
      setError('Select a job and destination department')
      return
    }
    if (weights.total > 0 && Math.abs(weights.total - capture.captured.weight) > 0.5) {
      setError(
        `Materials (${weights.total.toFixed(2)} g) must match captured weight (${capture.captured.weight.toFixed(2)} g)`,
      )
      return
    }

    setBusy(true)
    setError('')
    const operationId = inFlight.current || createOperationId(kind === 'in' ? 'metal_in' : 'metal_out')
    inFlight.current = operationId

    const materials =
      weights.total > 0
        ? [
            ...(weights.gold > 0 ? [{ code: 'gold', label: 'Gold', weight: weights.gold }] : []),
            ...(weights.alloy > 0 ? [{ code: 'alloy', label: 'Alloy', weight: weights.alloy }] : []),
          ]
        : undefined

    try {
      const net = await NetInfo.fetch()
      if (kind === 'in') {
        const payload = {
          passId,
          scaleId,
          stableReadingId: capture.captured.scaleReadingId,
          receivedWeight: capture.captured.weight,
          operationId,
          ...(materials ? { materials } : {}),
        }
        if (!net.isConnected) {
          await enqueueOutbox({ operationId, operationType: 'metal_in', payload, scaleId })
          Alert.alert('Saved offline', 'Metal IN queued — will sync when online.')
        } else {
          await metalIn(payload)
          Alert.alert('METAL IN RECORDED', `Weight: ${capture.captured.weight.toFixed(2)} g`)
        }
      } else {
        const job = (jobs.data || []).find((j) => String(j._id || j.batchId) === batchId)
        const payload = {
          batchId,
          toDepartment: toDepartment.trim(),
          fromDepartment: job?.currentDepartment || user?.department || '',
          scaleId,
          stableReadingId: capture.captured.scaleReadingId,
          weight: capture.captured.weight,
          operationId,
          purpose: 'MG Floor Metal OUT',
        }
        if (!net.isConnected) {
          await enqueueOutbox({ operationId, operationType: 'metal_out', payload, scaleId })
          Alert.alert('Saved offline', 'Metal OUT queued')
        } else {
          await metalOut(payload)
          Alert.alert('Success', 'Metal OUT recorded')
        }
      }
      inFlight.current = null
      capture.clearCapture()
      onSaved()
      onClose()
    } catch (err) {
      setError(userFacingMessage(err) || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{kind === 'in' ? 'Confirm Metal In' : 'Confirm Metal Out'}</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 16, gap: 10 }}>
            <Text style={styles.meta}>
              Entered total: {weights.total > 0 ? `${weights.total.toFixed(2)} g` : '—'} (Gold{' '}
              {weights.gold || 0} · Alloy {weights.alloy || 0})
            </Text>

            <AuthorizedScalePicker
              scaleId={scaleId}
              onSelect={setScaleId}
              scales={scales}
            />

            {kind === 'in' ? (
              <View>
                <Text style={styles.label}>Open pass</Text>
                {(passes.data || []).slice(0, 8).map((p) => (
                  <Pressable
                    key={p._id}
                    style={[styles.option, passId === p._id && styles.optionActive]}
                    onPress={() => setPassId(p._id)}
                  >
                    <Text style={[styles.optionText, passId === p._id && styles.optionTextActive]}>
                      {p.passNumber || p.batchNumber || p._id}
                    </Text>
                  </Pressable>
                ))}
                {!passes.data?.length ? <Text style={styles.meta}>No open passes</Text> : null}
              </View>
            ) : (
              <View>
                <Text style={styles.label}>Job / batch</Text>
                {(jobs.data || []).slice(0, 8).map((j) => {
                  const id = String(j._id || j.batchId || '')
                  return (
                    <Pressable
                      key={id}
                      style={[styles.option, batchId === id && styles.optionActive]}
                      onPress={() => setBatchId(id)}
                    >
                      <Text style={[styles.optionText, batchId === id && styles.optionTextActive]}>
                        {j.batchNumber || id}
                      </Text>
                    </Pressable>
                  )
                })}
                <Text style={styles.label}>To department</Text>
                <TextInput
                  style={styles.input}
                  value={toDepartment}
                  onChangeText={setToDepartment}
                  placeholder="e.g. casting"
                  placeholderTextColor={td.textMuted}
                  autoCapitalize="none"
                />
              </View>
            )}

            <StableCapturePanel scaleId={scaleId} capture={capture} busy={busy} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <Pressable
            style={[styles.confirm, busy && styles.disabled]}
            onPress={submit}
            disabled={busy}
          >
            <Text style={styles.confirmText}>{busy ? 'Saving…' : 'Confirm Save'}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: td.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '92%',
    padding: 16,
  },
  title: { color: td.text, fontWeight: '800', fontSize: 18, marginBottom: 10 },
  meta: { color: td.textMuted, fontWeight: '600' },
  label: { color: td.text, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
    marginBottom: 6,
  },
  optionActive: { backgroundColor: td.orange, borderColor: td.orange },
  optionText: { color: td.text, fontWeight: '600' },
  optionTextActive: { color: td.white },
  input: {
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: td.text,
    fontWeight: '600',
  },
  error: { color: '#DC2626', fontWeight: '600' },
  confirm: {
    backgroundColor: td.orange,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: td.radius,
    marginTop: 8,
  },
  confirmText: { color: td.white, fontWeight: '800', fontSize: 16 },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
  },
  cancelText: { color: td.text, fontWeight: '700' },
  disabled: { opacity: 0.45 },
})
