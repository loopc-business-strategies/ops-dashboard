// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import {
  findNextFocusIndex,
  focusNextInOrder,
  handleRecommendedTab,
  shouldSkipAutofilledAmountLc,
} from './voucherKeyboardNav'

function makeInput({ disabled = false, tabIndex, value = '' } = {}) {
  const el = document.createElement('input')
  el.disabled = disabled
  if (tabIndex !== undefined) el.tabIndex = tabIndex
  el.value = value
  document.body.appendChild(el)
  return el
}

describe('voucherKeyboardNav', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('findNextFocusIndex advances and wraps', () => {
    const a = makeInput()
    const b = makeInput()
    const c = makeInput()
    a.focus()
    expect(findNextFocusIndex([a, b, c], a, { reverse: false })).toBe(1)
    b.focus()
    expect(findNextFocusIndex([a, b, c], b, { reverse: false })).toBe(2)
    c.focus()
    expect(findNextFocusIndex([a, b, c], c, { reverse: false })).toBe(0)
    expect(findNextFocusIndex([a, b, c], c, { reverse: true })).toBe(1)
  })

  test('skips disabled and tabIndex -1 entries', () => {
    const a = makeInput()
    const b = makeInput({ disabled: true })
    const c = makeInput({ tabIndex: -1 })
    const d = makeInput()
    a.focus()
    expect(findNextFocusIndex([a, b, c, d], a)).toBe(3)
  })

  test('skipPred can skip autofilled amount LC slot', () => {
    const type = makeInput()
    const fc = makeInput({ value: '100' })
    const lc = makeInput({ value: '100.00' })
    const narr = makeInput()
    fc.focus()
    const order = [type, fc, lc, narr]
    const next = findNextFocusIndex(order, fc, {
      skipPred: (el) => el === lc && shouldSkipAutofilledAmountLc(lc.value, fc.value),
    })
    expect(next).toBe(3)
  })

  test('handleRecommendedTab prevents default and focuses next', () => {
    const a = makeInput()
    const b = makeInput()
    a.focus()
    const event = {
      key: 'Tab',
      shiftKey: false,
      target: a,
      preventDefault: vi.fn(),
    }
    const handled = handleRecommendedTab(event, { enabled: true, order: [a, b] })
    expect(handled).toBe(true)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(document.activeElement).toBe(b)
  })

  test('handleRecommendedTab is a no-op when disabled', () => {
    const a = makeInput()
    const b = makeInput()
    a.focus()
    const event = {
      key: 'Tab',
      shiftKey: false,
      target: a,
      preventDefault: vi.fn(),
    }
    expect(handleRecommendedTab(event, { enabled: false, order: [a, b] })).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  test('onWrapForward fires from last field', () => {
    const a = makeInput()
    const b = makeInput()
    b.focus()
    const onWrapForward = vi.fn()
    const event = {
      key: 'Tab',
      shiftKey: false,
      target: b,
      preventDefault: vi.fn(),
    }
    handleRecommendedTab(event, { enabled: true, order: [a, b], onWrapForward })
    expect(onWrapForward).toHaveBeenCalled()
  })

  test('focusNextInOrder moves focus', () => {
    const a = makeInput()
    const b = makeInput()
    a.focus()
    expect(focusNextInOrder([a, b], a)).toBe(true)
    expect(document.activeElement).toBe(b)
  })

  test('shouldSkipAutofilledAmountLc requires both FC and non-zero LC', () => {
    expect(shouldSkipAutofilledAmountLc('12.50', '100')).toBe(true)
    expect(shouldSkipAutofilledAmountLc('', '100')).toBe(false)
    expect(shouldSkipAutofilledAmountLc('12.50', '')).toBe(false)
    expect(shouldSkipAutofilledAmountLc('0', '100')).toBe(false)
  })
})
