import { describe, expect, it } from 'vitest'
import { fillNextQty, setPendingFill, takePendingFill } from './captureFill'
import type { MetalBatchEdit } from './MetalProcessPanel'

function table(qtys: string[][]): MetalBatchEdit[] {
  return qtys.map((lines, i) => ({
    batchLabel: String(i + 1),
    lines: lines.map((qty, j) => ({ metal: j === 0 ? 'Gold' : 'Alloy', qty, purity: '', time: '' })),
  }))
}

describe('fillNextQty', () => {
  it('fills Batch 1 Gold first and stamps its time', () => {
    const { batches, filled } = fillNextQty(table([['', ''], ['', '']]), '10.00 g', '09:30')
    expect(filled).toBe(true)
    expect(batches[0].lines[0]).toMatchObject({ qty: '10.00 g', time: '09:30' })
    expect(batches[0].lines[1].qty).toBe('')
    expect(batches[1].lines[0].qty).toBe('')
  })

  it('moves on in order: Batch 1 Alloy, then Batch 2 Gold', () => {
    let result = fillNextQty(table([['5 g', ''], ['', '']]), '6.00 g', '09:31')
    expect(result.batches[0].lines[1].qty).toBe('6.00 g')
    result = fillNextQty(result.batches, '7.00 g', '09:32')
    expect(result.batches[1].lines[0].qty).toBe('7.00 g')
  })

  it('never overwrites filled cells and treats whitespace as empty', () => {
    const { batches } = fillNextQty(table([['5 g', '  '], ['', '']]), '8.00 g', '09:33')
    expect(batches[0].lines[0].qty).toBe('5 g')
    expect(batches[0].lines[1].qty).toBe('8.00 g')
  })

  it('reports a full table without changing it', () => {
    const full = table([['1 g', '2 g'], ['3 g', '4 g']])
    const { batches, filled } = fillNextQty(full, '9.00 g', '09:34')
    expect(filled).toBe(false)
    expect(batches).toBe(full)
  })
})

describe('pending fill hand-off', () => {
  it('is taken once', () => {
    setPendingFill({ side: 'out', qty: '1.00 g', at: '2026-09-28T00:00:00.000Z' })
    expect(takePendingFill()).toMatchObject({ side: 'out', qty: '1.00 g' })
    expect(takePendingFill()).toBeNull()
  })
})
