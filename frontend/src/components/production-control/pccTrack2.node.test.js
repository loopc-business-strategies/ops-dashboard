import { describe, expect, test } from 'vitest'

/**
 * Pure helpers mirrored from PlanningPanel / BatchDetailModal for Track 2 coverage
 * without mounting React (node-safe unit path).
 */
function toDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function buildGanttRows(workOrders) {
  const rows = []
  for (const wo of workOrders || []) {
    const start = toDate(wo.startDate) || toDate(wo.createdAt)
    const end = toDate(wo.targetDate)
    if (!start && !end) continue
    rows.push({
      id: wo._id,
      start: start || end,
      end: end || start,
      milestone: !end || !start || start.getTime() === end.getTime(),
    })
  }
  return rows
}

function enrichTimeline(detail) {
  const existing = Array.isArray(detail?.timeline) ? [...detail.timeline] : []
  if (existing.length > 0) {
    return existing.filter((e) => e?.at).sort((a, b) => new Date(a.at) - new Date(b.at))
  }
  const events = []
  if (detail?.batch?.createdAt) {
    events.push({ at: detail.batch.createdAt, type: 'created', label: 'created' })
  }
  for (const p of detail?.processes || []) {
    if (p.startTime) events.push({ at: p.startTime, type: 'process_start', label: p.process })
    if (p.endTime) events.push({ at: p.endTime, type: 'process_end', label: p.process })
  }
  return events.sort((a, b) => new Date(a.at) - new Date(b.at))
}

describe('PCC track 2 planning + timeline', () => {
  test('gantt rows use real WO dates and mark undated milestones', () => {
    const rows = buildGanttRows([
      { _id: '1', createdAt: '2026-09-01T00:00:00Z', targetDate: '2026-09-10T00:00:00Z' },
      { _id: '2', createdAt: '2026-09-05T00:00:00Z' },
      { _id: '3', product: 'no dates' },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].milestone).toBe(false)
    expect(rows[1].milestone).toBe(true)
  })

  test('timeline falls back to processes when API timeline empty', () => {
    const events = enrichTimeline({
      timeline: [],
      batch: { createdAt: '2026-09-01T08:00:00Z', batchNumber: 'B1' },
      processes: [
        { process: 'Casting', startTime: '2026-09-01T09:00:00Z', endTime: '2026-09-01T11:00:00Z' },
      ],
    })
    expect(events.map((e) => e.type)).toEqual(['created', 'process_start', 'process_end'])
  })

  test('timeline prefers API events when present', () => {
    const events = enrichTimeline({
      timeline: [{ at: '2026-09-02T00:00:00Z', type: 'qc', label: 'QC PASS' }],
      processes: [{ process: 'X', startTime: '2026-09-01T00:00:00Z' }],
    })
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('qc')
  })
})
