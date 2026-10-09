/** Sidebar sections in their default order; `group` is the navConfig item group shown in that section. */
export const NAV_SECTIONS = [
  { key: 'workspace', group: 'main' },
  { key: 'departments', group: 'departments' },
  { key: 'erp', group: 'erp' },
  { key: 'admin', group: 'admin' },
]

export const DEFAULT_SECTION_ORDER = NAV_SECTIONS.map((s) => s.key)

export const EMPTY_NAV_LAYOUT = { sections: [], items: {} }

/** Saved section order first, then any section not in it, in the default order. */
export function orderSections(saved, available = DEFAULT_SECTION_ORDER) {
  const allowed = new Set(available)
  const seen = new Set()
  const out = []
  ;[...(Array.isArray(saved) ? saved : []), ...DEFAULT_SECTION_ORDER].forEach((key) => {
    if (allowed.has(key) && !seen.has(key)) {
      seen.add(key)
      out.push(key)
    }
  })
  return out
}

/** Items in the saved id order; items not in it (new or newly permitted) keep their default order at the end. */
export function applyItemOrder(items, savedIds) {
  const list = Array.isArray(items) ? items : []
  if (!Array.isArray(savedIds) || !savedIds.length) return list
  const rank = new Map(savedIds.map((id, i) => [id, i]))
  return list
    .map((item, i) => ({ item, i, r: rank.has(item.id) ? rank.get(item.id) : Infinity }))
    .sort((a, b) => (a.r - b.r) || (a.i - b.i))
    .map(({ item }) => item)
}

/** Copy of `list` with the entry at `index` moved by `delta` (-1 up, +1 down); unchanged at either end. */
export function moveInList(list, index, delta) {
  const next = [...list]
  const target = index + delta
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** Copy of `list` with the entry at `from` moved to position `to`; unchanged when either index is out of range. */
export function reorderList(list, from, to) {
  const next = [...list]
  if (from === to || from < 0 || from >= next.length || to < 0 || to >= next.length) return next
  const [entry] = next.splice(from, 1)
  next.splice(to, 0, entry)
  return next
}

/**
 * How many slots each row should slide while index `from` is dragged by `deltaSlots`
 * (positive = down). The dragged row is 0 here; it follows the pointer separately.
 * `to` is the clamped drop index.
 */
export function dragShift(count, from, deltaSlots) {
  const shifts = Array.from({ length: Math.max(0, count) }, () => 0)
  if (from < 0 || from >= count) return { shifts, to: from }
  const to = Math.max(0, Math.min(count - 1, from + deltaSlots))
  const step = to > from ? -1 : 1
  for (let i = Math.min(from, to); i <= Math.max(from, to); i += 1) {
    if (i !== from) shifts[i] = step
  }
  return { shifts, to }
}

export function normalizeNavLayout(raw) {
  const sections = Array.isArray(raw?.sections) ? raw.sections.filter((s) => DEFAULT_SECTION_ORDER.includes(s)) : []
  const items = {}
  NAV_SECTIONS.forEach(({ group }) => {
    const ids = raw?.items?.[group]
    if (Array.isArray(ids) && ids.length) items[group] = ids.filter((id) => typeof id === 'string')
  })
  return { sections, items }
}
