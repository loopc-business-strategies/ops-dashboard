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
  batchKey,
  carriedOverEntries,
  latestEntries,
  localDateKey,
  prepareBatchLines,
  previousDateKey,
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
}

type SentLines = Map<BatchKey, { lines: BatchEntryLine[] }>

function isTransient(kind: string) {
  return kind === 'NETWORK_ERROR' || kind === 'TIMEOUT' || kind === 'SERVER_ERROR' || kind === 'OFFLINE'
}

/**
 * Floor Manager approval for Metal In / Out batches: loads today's entries for the department plus
 * yesterday's batches still open at midnight (night shift), sends one batch at a time (offline
 * outbox when there is no connection) and refreshes every 30 s.
 */
export function useBatchApprovals({ token, department }: Options) {
  const [states, setStates] = useState<Partial<Record<BatchKey, BatchApprovalState>>>({})
  const statesRef = useRef(states)
  statesRef.current = states
  const [sent, setSent] = useState<SentLines>(() => new Map())
  const sentRef = useRef(sent)
  sentRef.current = sent
  const [busyKey, setBusyKey] = useState<BatchKey | null>(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    if (!token || !department) return
    const request = ++requestRef.current
    const today = localDateKey()
    const yesterday = previousDateKey()
    const [todayRes, yesterdayRes, outbox] = await Promise.all([
      fetchBatchEntries({ entryDate: today, department, limit: 100 }).catch(() => null),
      fetchBatchEntries({ entryDate: yesterday, department, limit: 100 }).catch(() => null),
      listOutbox().catch(() => []),
    ])
    if (request !== requestRef.current) return

    const next: Partial<Record<BatchKey, BatchApprovalState>> = {}
    const nextSent: SentLines = new Map()
    if (todayRes && yesterdayRes) {
      const entries = [...todayRes.entries, ...carriedOverEntries(yesterdayRes.entries, today)]
      for (const [key, entry] of latestEntries(entries)) {
        next[key] = stateFromEntry(entry)
        nextSent.set(key, { lines: entry.lines })
      }
    } else {
      for (const [key, state] of Object.entries(statesRef.current) as Array<[BatchKey, BatchApprovalState]>) {
        if (state.status !== 'QUEUED') next[key] = state
      }
      for (const [key, value] of sentRef.current) if (next[key]) nextSent.set(key, value)
    }

    for (const item of outbox) {
      if (item.operationType !== 'batch_entry' || !QUEUED_SYNC_STATUSES.has(item.syncStatus)) continue
      const body = item.payload as unknown as SubmitBatchEntryBody
      if ((body.entryDate !== today && body.entryDate !== yesterday) || (body.department || '') !== department) continue
      const key = batchKey(body.entryDate, body.direction, body.batchLabel)
      const current = next[key]
      if (current && current.status !== 'REJECTED') continue
      if (current?.entryId === body.entryId) continue
      next[key] = { status: 'QUEUED', entryId: body.entryId }
      nextSent.set(key, { lines: body.lines })
    }

    setSent(nextSent)
    setStates(next)
  }, [token, department])

  useEffect(() => {
    setSent(new Map())
    setStates({})
    if (!token || !department) return
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      clearInterval(timer)
      requestRef.current += 1
    }
  }, [token, department, load])

  /** Sends one batch; resolves to an error message, or null once it is sent or saved offline. */
  const confirm = useCallback(
    async (direction: BatchDirection, batch: MetalBatchEdit): Promise<string | null> => {
      if (!token) return 'Log in to send for Floor Manager approval'
      if (!department) return 'No floor department is assigned to your account. Ask an admin.'
      if (busyKey) return 'Another batch is still being sent'
      const { lines, error } = prepareBatchLines(batch)
      if (error) return error
      const entryDate = batch.entryDate || localDateKey()
      const key = batchKey(entryDate, direction, batch.batchLabel)
      const deviceId = await getDeviceId().catch(() => '')
      const body: SubmitBatchEntryBody = {
        entryId: createOperationId('be'),
        direction,
        department,
        batchLabel: batch.batchLabel,
        entryDate,
        deviceId: deviceId || null,
        tzOffsetMinutes: -new Date().getTimezoneOffset(),
        lines,
      }
      setBusyKey(key)
      requestRef.current += 1

      const lock = (state: BatchApprovalState, sentLines: BatchEntryLine[]) => {
        setSent((prev) => new Map(prev).set(key, { lines: sentLines }))
        setStates((prev) => ({ ...prev, [key]: state }))
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
          return null
        }
        const res = await submitBatchEntry(body)
        lock(stateFromEntry(res.entry), res.entry.lines)
        return null
      } catch (err) {
        const e = toApiError(err)
        if (isTransient(e.kind)) {
          await queue()
          return null
        }
        if (e.status === 409) load()
        return e.message || 'Could not send to the Floor Manager'
      } finally {
        setBusyKey(null)
      }
    },
    [token, busyKey, department, load],
  )

  return { states, sent, busyKey, confirm, reload: load }
}
