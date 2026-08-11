/**
 * Recommended Tab-order focus helpers for voucher / JV / fixing entry (LoopC-gated).
 */

export function resolveFocusTarget(entry) {
  if (!entry) return null
  if (typeof entry === 'object' && 'current' in entry) {
    return resolveFocusTarget(entry.current)
  }
  if (typeof entry?.focus === 'function' && !entry.tagName) {
    // Imperative handle (e.g. AccountCombobox ref)
    return entry
  }
  if (entry?.nodeType === 1) {
    const nested = entry.querySelector?.('[data-vk-focus-target]')
    return nested || entry
  }
  return null
}

export function isFocusableElement(el) {
  const target = resolveFocusTarget(el)
  if (!target) return false
  if (typeof target.focus === 'function' && !target.tagName) {
    return true
  }
  if (target.disabled) return false
  if (target.getAttribute?.('aria-disabled') === 'true') return false
  if (String(target.getAttribute?.('tabindex') || '') === '-1') return false
  if (target.hidden || target.getAttribute?.('hidden') != null) return false
  if (target.type === 'hidden') return false
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' && target.nodeType === 1) {
    const style = window.getComputedStyle(target)
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false
  }
  return true
}

export function focusElement(entry) {
  const target = resolveFocusTarget(entry)
  if (!target || !isFocusableElement(target)) return false
  try {
    target.focus?.({ preventScroll: false })
  } catch {
    target.focus?.()
  }
  if (typeof target.select === 'function' && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    try {
      target.select()
    } catch {
      // ignore
    }
  }
  return true
}

/**
 * Resolve next/prev index in an ordered list, wrapping within the list.
 * @param {Array} order - refs, elements, or imperative handles
 * @param {Element|null} current - document.activeElement or related target
 * @param {{ reverse?: boolean, skipPred?: (el, index) => boolean }} options
 */
export function findNextFocusIndex(order, current, { reverse = false, skipPred = null } = {}) {
  const resolved = (order || []).map((entry, index) => ({ entry, index, target: resolveFocusTarget(entry) }))
  const usable = resolved.filter(({ entry, index, target }) => {
    if (!isFocusableElement(entry)) return false
    if (typeof skipPred === 'function' && skipPred(target || entry, index)) return false
    return true
  })
  if (!usable.length) return -1

  const active = resolveFocusTarget(current) || current
  let currentUsableIdx = usable.findIndex(({ target, entry }) => {
    if (!active) return false
    if (target === active) return true
    if (entry === active) return true
    if (typeof entry?.contains === 'function' && entry.contains(active)) return true
    if (target && typeof target.contains === 'function' && target.contains(active)) return true
    // Imperative handle: compare underlying input if exposed
    if (entry?.input && entry.input === active) return true
    return false
  })

  if (currentUsableIdx < 0) {
    return reverse ? usable[usable.length - 1].index : usable[0].index
  }

  const nextUsableIdx = reverse
    ? (currentUsableIdx - 1 + usable.length) % usable.length
    : (currentUsableIdx + 1) % usable.length
  return usable[nextUsableIdx].index
}

export function focusNextInOrder(order, current, options = {}) {
  const nextIndex = findNextFocusIndex(order, current, options)
  if (nextIndex < 0) return false
  return focusElement(order[nextIndex])
}

/**
 * Handle Tab / Shift+Tab within a recommended field order.
 * @returns {boolean} true if the event was handled
 */
export function handleRecommendedTab(event, {
  enabled = true,
  order = [],
  skipPred = null,
  onBeforeMove = null,
  onWrapForward = null,
} = {}) {
  if (!enabled || !event || event.key !== 'Tab') return false
  const reverse = Boolean(event.shiftKey)
  const resolvedOrder = typeof order === 'function' ? order() : order
  if (!Array.isArray(resolvedOrder) || resolvedOrder.length === 0) return false

  const current = event.target
  const nextIndex = findNextFocusIndex(resolvedOrder, current, { reverse, skipPred })
  if (nextIndex < 0) return false

  const currentIndex = resolvedOrder.findIndex((entry) => {
    const target = resolveFocusTarget(entry)
    if (!current || !target) return false
    if (target === current) return true
    if (typeof entry?.contains === 'function' && entry.contains(current)) return true
    if (entry?.input === current) return true
    return false
  })

  // Forward wrap from last field → optional callback (e.g. add JV row) instead of cycling
  if (!reverse && typeof onWrapForward === 'function' && currentIndex >= 0) {
    const usableForward = resolvedOrder
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry, index }) => {
        if (!isFocusableElement(entry)) return false
        if (typeof skipPred === 'function' && skipPred(resolveFocusTarget(entry) || entry, index)) return false
        return true
      })
    const lastUsable = usableForward[usableForward.length - 1]
    const isOnLast = lastUsable && (
      resolveFocusTarget(lastUsable.entry) === resolveFocusTarget(current)
      || lastUsable.entry?.input === current
      || (typeof lastUsable.entry?.contains === 'function' && lastUsable.entry.contains(current))
    )
    if (isOnLast) {
      event.preventDefault()
      onBeforeMove?.(event, { reverse, nextIndex: -1, wrapForward: true })
      onWrapForward(event)
      return true
    }
  }

  event.preventDefault()
  onBeforeMove?.(event, { reverse, nextIndex, wrapForward: false })
  focusElement(resolvedOrder[nextIndex])
  return true
}

/** True when AMT LC should be skipped after FC/rate autofill. */
export function shouldSkipAutofilledAmountLc(amountLc, amountFc, { skipWhenUnderscored = true } = {}) {
  if (!skipWhenUnderscored) return false
  const lc = String(amountLc ?? '').trim()
  const fc = String(amountFc ?? '').trim()
  if (!lc || !fc) return false
  const lcNum = Number(lc)
  return Number.isFinite(lcNum) && lcNum !== 0
}
