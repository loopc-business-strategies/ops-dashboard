import { describe, expect, test } from 'vitest'
import { applyItemOrder, moveInList, normalizeNavLayout, orderSections } from './navLayout'

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

describe('normalizeNavLayout', () => {
  test('keeps only known sections and groups', () => {
    expect(normalizeNavLayout({ sections: ['erp', 'x'], items: { erp: ['erp-ledger'], other: ['y'] } }))
      .toEqual({ sections: ['erp'], items: { erp: ['erp-ledger'] } })
  })

  test('handles missing input', () => {
    expect(normalizeNavLayout(null)).toEqual({ sections: [], items: {} })
  })
})
