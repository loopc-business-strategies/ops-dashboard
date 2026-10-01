const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (today, n) => ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n))

/** Quick ranges relative to the browser's today. */
export function historyPresets(today = new Date()) {
  return [
    { id: 'today', label: 'Today', from: ymd(today), to: ymd(today) },
    { id: 'yesterday', label: 'Yesterday', from: daysAgo(today, 1), to: daysAgo(today, 1) },
    { id: 'last_7', label: 'Last 7 days', from: daysAgo(today, 6), to: ymd(today) },
    { id: 'last_30', label: 'Last 30 days', from: daysAgo(today, 29), to: ymd(today) },
  ]
}

export const BATCH_STATUS = {
  waiting: { label: 'Waiting for F.M', color: '#9a3412', bg: '#fff7ed' },
  sent_back: { label: 'Sent back to operator', color: '#b91c1c', bg: '#fef2f2' },
  running: { label: 'Running', color: '#1d4ed8', bg: '#eff6ff' },
  finished: { label: 'Finished', color: '#065f46', bg: 'rgba(0,200,150,.12)' },
}

/** Status of one side's newest entry, e.g. "Approval undone". */
export function sideStatusText(side) {
  if (!side) return 'Not sent'
  if (side.status === 'APPROVED') return 'Approved'
  if (side.status === 'PENDING') return 'Waiting for F.M'
  return side.undone ? 'Approval undone' : 'Rejected'
}

const sideName = (direction) => (direction === 'IN' ? 'Metal In' : 'Metal Out')

function linesText(lines) {
  return (lines || [])
    .map((l) => [l.metal, l.qty != null ? `${l.qty} g` : null, l.purity != null ? `${l.purity}%` : null, l.time || null].filter(Boolean).join(' · '))
    .join('  |  ')
}

/** One timeline line: what happened and the extra detail (lines sent, or the reason). */
export function eventText(e) {
  const side = sideName(e.direction)
  const by = e.by ? ` by ${e.by}` : ''
  switch (e.type) {
    case 'sent':
      return { tone: 'sent', title: `${side} sent${by}`, detail: linesText(e.lines) }
    case 'approved':
      return { tone: 'approved', title: `${side} approved${by}`, detail: '' }
    case 'rejected':
      return { tone: 'rejected', title: `${side} rejected${by}`, detail: e.reason ? `Reason: ${e.reason}` : '' }
    case 'undone':
      return { tone: 'undone', title: `${side} approval undone${by}`, detail: e.reason ? `Reason: ${e.reason}` : '' }
    default:
      return { tone: 'sent', title: `${side} ${e.type}${by}`, detail: '' }
  }
}

/** How many batches are in each status, e.g. { finished: 3, waiting: 1, ... }. */
export function countByStatus(batches) {
  const counts = Object.fromEntries(Object.keys(BATCH_STATUS).map((k) => [k, 0]))
  for (const b of batches || []) if (b.status in counts) counts[b.status] += 1
  return counts
}
