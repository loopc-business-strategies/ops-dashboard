import { describe, expect, test } from 'vitest'
import { applyItemOrder, dragShift, moveInList, normalizeNavLayout, orderSections, reorderList } from './navLayout'

const items = (...ids) => ids.map((id) => ({ id }))
const ids = (list) => list.map((item) => item.id)

describe('orderSections', () => {
  test('defaults when nothing is saved', () => {
    expect(orderSections(undefined)).toEqual(['workspace', 'departments', 'erp', 'admin'])
  })

  test('saved order first, missing sections appended in default order', () => {
    expect(orderSections(['erp', 'workspace'])).toEqual(['erp', 'workspace', 'departments', 'admin'])
  })

  test('drops unknown and duplicate keys and respects available sections', () => {
    expect(orderSections(['admin', 'bogus', 'admin', 'erp'], ['workspace', 'erp'])).toEqual(['erp', 'workspace'])
  })
})

describe('applyItemOrder', () => {
  test('keeps default order with no saved ids', () => {
    expect(ids(applyItemOrder(items('a', 'b', 'c'), []))).toEqual(['a', 'b', 'c'])
  })

  test('saved order first, new items appended in default order, unknown ids ignored', () => {
    const out = applyItemOrder(items('a', 'b', 'c', 'd'), ['c', 'gone', 'a'])
    expect(ids(out)).toEqual(['c', 'a', 'b', 'd'])
  })
})

describe('moveInList', () => {
  test('moves up and down', () => {
    expect(moveInList(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveInList(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })

  test('unchanged at either end', () => {
    expect(moveInList(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveInList(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})

describe('reorderList', () => {
  test('moves an entry down and up', () => {
    expect(reorderList(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(reorderList(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  test('unchanged for the same or out-of-range index', () => {
    expect(reorderList(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
    expect(reorderList(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
    expect(reorderList(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })
})

describe('dragShift', () => {
  test('slides neighbours down and up', () => {
    expect(dragShift(4, 0, 2)).toEqual({ shifts: [0, -1, -1, 0], to: 2 })
    expect(dragShift(4, 3, -2)).toEqual({ shifts: [0, 1, 1, 0], to: 1 })
  })

  test('clamps at either end', () => {
    expect(dragShift(3, 0, -5)).toEqual({ shifts: [0, 0, 0], to: 0 })
    expect(dragShift(3, 2, 4)).toEqual({ shifts: [0, 0, 0], to: 2 })
  })
})

describe('normalizeNavLayout', () => {
  test('keeps only known sections and groups', () => {
    expect(normalizeNavLayout({ sections: ['erp', 'x'], items: { erp: ['erp-ledger'], other: ['y'] } }))
      .toEqual({ sections: ['erp'], items: { erp: ['erp-ledger'] } })
  })

  test('handles missing input', () => {
    expect(normalizeNavLayout(null)).toEqual({ sections: [], items: {} })
  })
})
