/** 0 -> "under 1 min", 60 -> "1h", 95 -> "1h 35m", 3000 -> "2d 2h", null -> "—". */
export function formatDelay(minutes) {
  if (minutes == null) return '—'
  if (minutes < 1) return 'under 1 min'
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  if (d) return h ? `${d}d ${h}h` : `${d}d`
  if (h) return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`
  return `${m}m`
}

const BATCH_TEXT = {
  PENDING: { label: 'Waiting for F.M', color: '#9a3412', bg: '#fff7ed' },
  APPROVED: { label: 'Approved', color: '#065f46', bg: 'rgba(0,200,150,.12)' },
  REJECTED: { label: 'Rejected', color: '#b91c1c', bg: '#fef2f2' },
}
const PROBLEM_TEXT = {
  FAILED: 'Failed — not received',
  CONFLICT: 'Conflict — not received',
  SYNCING: 'Stuck while sending',
  PENDING: 'Not sent yet',
}

/** Status pill for one offline item: the batch's approval status once synced, else what went wrong. */
export function syncStatusPill(item) {
  if (item?.status === 'SYNCED') {
    return BATCH_TEXT[item.batchStatus] || { label: 'Received', color: '#065f46', bg: 'rgba(0,200,150,.12)' }
  }
  return { label: PROBLEM_TEXT[item?.status] || item?.status || '—', color: '#b91c1c', bg: '#fef2f2', problem: true }
}

/** "Metal In" / "Metal Out" for batches; other offline types by name. */
export function syncItemKind(item) {
  if (item?.type !== 'batch_entry') return String(item?.type || '').replace(/_/g, ' ')
  return item.direction === 'OUT' ? 'Metal Out' : item.direction === 'IN' ? 'Metal In' : 'Batch'
}

/** Last 6 characters of a tablet id, enough to tell tablets apart. */
export const shortDevice = (id) => (id ? `…${String(id).slice(-6)}` : '—')
