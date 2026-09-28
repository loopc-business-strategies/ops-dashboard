import { useCallback, useEffect, useRef, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { toApiError } from '@/src/api/errors'
import {
  fetchBatchEntries,
  submitBatchEntry,
  type BatchDirection,
  type BatchEntryLine,
  type SubmitBatchEntryBody,
} from '@/src/api/batchEntries'
import { getDeviceId } from '@/src/device/deviceIdentity'
import { createOperationId, enqueueOutbox, listOutbox } from '@/src/offline/outbox'
import {
  applyEntryLines,
  batchKey,
  latestEntries,
  localDateKey,
  prepareBatchLines,
  stateFromEntry,
  type BatchApprovalState,
  type BatchKey,
} from './batchEntryMapping'
import type { MetalBatchEdit } from './MetalProcessPanel'

const POLL_MS = 30000
const QUEUED_SYNC_STATUSES = new Set(['PENDING', 'SYNCING', 'FAILED'])

type Options = {
  token: string | null
  department: string
  setBatches: (direction: BatchDirection, update: (batches: MetalBatchEdit[]) => MetalBatchEdit[]) => void
}

function isTransient(kind: string) {
  return kind === 'NETWORK_ERROR' || kind === 'TIMEOUT' || kind === 'SERVER_ERROR' || kind === 'OFFLINE'
}

/**
 * Floor Manager approval for typed Metal In / Out batches: loads today's entries for the department,
 * sends one batch at a time (offline outbox when there is no connection) and refreshes every 30 s.
 */
export function useBatchApprovals({ token, department, setBatches }: Options) {
  const [states, setStates] = useState<Partial<Record<BatchKey, BatchApprovalState>>>({})
  const statesRef = useRef(states)
  statesRef.current = states
  const [busyKey, setBusyKey] = useState<BatchKey | null>(null)
  const [message, setMessage] = useState<{ direction: BatchDirection; text: string } | null>(null)
  const sentRef = useRef(new Map<BatchKey, { lines: BatchEntryLine[] }>())
  const requestRef = useRef(0)
  const firstLoadRef = useRef(true)
  const setBatchesRef = useRef(setBatches)
  setBatchesRef.current = setBatches

  const writeBack = useCallback(() => {
    const sent = sentRef.current
    setBatchesRef.current('IN', (b) => applyEntryLines(b, 'IN', sent))
    setBatchesRef.current('OUT', (b) => applyEntryLines(b, 'OUT', sent))
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    const request = ++requestRef.current
    const day = localDateKey()
    const [res, outbox] = await Promise.all([
      fetchBatchEntries({ entryDate: day, department, limit: 100 }).catch(() => null),
      listOutbox().catch(() => []),
    ])
    if (request !== requestRef.current) return

    const next: Partial<Record<BatchKey, BatchApprovalState>> = {}
    const sent = new Map<BatchKey, { lines: BatchEntryLine[] }>()
    if (res) {
      for (const [key, entry] of latestEntries(res.entries)) {
        next[key] = stateFromEntry(entry)
        if (entry.status !== 'REJECTED' || firstLoadRef.current) sent.set(key, { lines: entry.lines })
      }
    } else {
      for (const [key, state] of Object.entries(statesRef.current) as Array<[BatchKey, BatchApprovalState]>) {
        if (state.status !== 'QUEUED') next[key] = state
      }
      for (const [key, value] of sentRef.current) if (next[key]) sent.set(key, value)
    }

    for (const item of outbox) {
      if (item.operationType !== 'batch_entry' || !QUEUED_SYNC_STATUSES.has(item.syncStatus)) continue
      const body = item.payload as unknown as SubmitBatchEntryBody
      if (body.entryDate !== day || (body.department || '') !== department) continue
      const key = batchKey(body.direction, body.batchLabel)
      const current = next[key]
      if (current && current.status !== 'REJECTED') continue
      if (current?.entryId === body.entryId) continue
      next[key] = { status: 'QUEUED', entryId: body.entryId }
      sent.set(key, { lines: body.lines })
    }

    firstLoadRef.current = false
    sentRef.current = sent
    setStates(next)
    writeBack()
  }, [token, department, writeBack])

  useEffect(() => {
    firstLoadRef.current = true
    sentRef.current = new Map()
    setStates({})
    if (!token) return
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      clearInterval(timer)
      requestRef.current += 1
    }
  }, [token, department, load])

  /** Re-apply sent values after the tables are rebuilt from history. */
  const overlay = useCallback(
    (direction: BatchDirection, batches: MetalBatchEdit[]) => applyEntryLines(batches, direction, sentRef.current),
    [],
  )

  const confirm = useCallback(
    async (direction: BatchDirection, batch: MetalBatchEdit) => {
      if (!token || busyKey) return
      const { lines, error } = prepareBatchLines(batch)
      if (error) {
        setMessage({ direction, text: error })
        return
      }
      const key = batchKey(direction, batch.batchLabel)
      const deviceId = await getDeviceId().catch(() => '')
      const body: SubmitBatchEntryBody = {
        entryId: createOperationId('be'),
        direction,
        department,
        batchLabel: batch.batchLabel,
        entryDate: localDateKey(),
        deviceId: deviceId || null,
        lines,
      }
      setMessage(null)
      setBusyKey(key)
      requestRef.current += 1

      const lock = (state: BatchApprovalState, sentLines: BatchEntryLine[]) => {
        sentRef.current = new Map(sentRef.current).set(key, { lines: sentLines })
        setStates((prev) => ({ ...prev, [key]: state }))
        writeBack()
      }
      const queue = async () => {
        await enqueueOutbox({
          operationId: `be_${body.entryId}`,
          operationType: 'batch_entry',
          payload: body as unknown as Record<string, unknown>,
          deviceId: deviceId || undefined,
        })
        lock({ status: 'QUEUED', entryId: body.entryId }, lines)
      }

      try {
        const net = await NetInfo.fetch().catch(() => null)
        if (net && net.isConnected === false) {
          await queue()
          return
        }
        const res = await submitBatchEntry(body)
        lock(stateFromEntry(res.entry), res.entry.lines)
      } catch (err) {
        const e = toApiError(err)
        if (isTransient(e.kind)) {
          await queue()
        } else {
          setMessage({ direction, text: e.message || 'Could not send to the Floor Manager' })
          if (e.status === 409) load()
        }
      } finally {
        setBusyKey(null)
      }
    },
    [token, busyKey, department, load, writeBack],
  )

  return { states, busyKey, message, confirm, overlay, reload: load }
}
