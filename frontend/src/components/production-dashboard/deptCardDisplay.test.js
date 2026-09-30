import { describe, expect, test } from 'vitest'
import { resolveDeptCardDisplay } from './deptCardDisplay'
import { buildLoopcOpsDashboardOverlay } from './applyLoopcOpsEntries'
import { dayKey } from './safeMath'

const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })

const row = (batchNumber, batchStartedAt, batchOverAt, extra = {}) => ({
  _id: `r${batchNumber}`,
  date: dayKey(),
  departmentKey: 'rolling',
  batchNumber,
  metalIn: 100,
  metalOut: batchOverAt ? 99 : null,
  batchStartedAt,
  batchOverAt,
  ...extra,
})

const rollingCard = (entries) => buildLoopcOpsDashboardOverlay(entries).deptCards.find((c) => c.key === 'rolling')
const mgOptions = { suppressDemo: true, currentBatchTimes: true }

describe('MG Production Dashboard card times follow the current batch', () => {
  const b1 = row('1', '2026-09-28T07:48:00.000Z', '2026-09-28T07:50:00.000Z')
  const b2 = row('2', '2026-09-28T08:05:00.000Z', '2026-09-28T08:14:00.000Z')
  const b3Running = row('3', '2026-09-28T08:20:00.000Z', null)

  test('a running batch shows its own start and no Batch Over', () => {
    const ui = resolveDeptCardDisplay(rollingCard([b1, b2, b3Running]), [], [], mgOptions)
    expect(ui.status).toBe('Running')
    expect(ui.batchStartedLabel).toBe(clock(b3Running.batchStartedAt))
    expect(ui.batchOverLabel).toBe('—')
  })

  test('once Metal OUT is approved the card shows that batch\'s start and over', () => {
    const ui = resolveDeptCardDisplay(rollingCard([b1, b2]), [], [], mgOptions)
    expect(ui.status).toBe('Completed')
    expect(ui.batchStartedLabel).toBe(clock(b2.batchStartedAt))
    expect(ui.batchOverLabel).toBe(clock(b2.batchOverAt))
    expect(ui.progressPercent).toBe(100)
  })

  test('without the MG option the existing day-span / estimate behaviour is unchanged', () => {
    const ui = resolveDeptCardDisplay(rollingCard([b1, b2, b3Running]), [], [], { suppressDemo: true })
    expect(ui.batchStartedLabel).toBe(clock(b1.batchStartedAt))
    expect(ui.batchOverLabel).toBe(clock(b2.batchOverAt))
  })

  test('Avg. Time counts finished batches only, not the running batch clock', () => {
    const overlay = buildLoopcOpsDashboardOverlay([b1, b2, b3Running])
    const card = overlay.deptCards.find((c) => c.key === 'rolling')
    expect(card.avgTimeMin).toBe(6)
    const withRunning = resolveDeptCardDisplay(card, overlay.batchMonitorRows, [], mgOptions)
    const finishedOnly = buildLoopcOpsDashboardOverlay([b1, b2])
    const withoutRunning = resolveDeptCardDisplay(
      finishedOnly.deptCards.find((c) => c.key === 'rolling'),
      finishedOnly.batchMonitorRows,
      [],
      mgOptions,
    )
    expect(withRunning.avgTimeLabel).toBe(withoutRunning.avgTimeLabel)

    const onlyRunning = buildLoopcOpsDashboardOverlay([b3Running])
    const ui = resolveDeptCardDisplay(onlyRunning.deptCards.find((c) => c.key === 'rolling'), onlyRunning.batchMonitorRows, [], mgOptions)
    expect(ui.avgTimeLabel).toBe('—')
  })

  test('cards not built from the workbook keep their own times with the MG option', () => {
    const liveCard = { key: 'rolling', name: 'Rolling', status: 'Running', startedAt: '2026-09-28T06:00:00.000Z', avgTimeMin: 30 }
    const ui = resolveDeptCardDisplay(liveCard, [], [], mgOptions)
    expect(ui.batchStartedLabel).toBe(clock(liveCard.startedAt))
    expect(ui.batchOverLabel).toBe(clock('2026-09-28T06:30:00.000Z'))
  })
})
