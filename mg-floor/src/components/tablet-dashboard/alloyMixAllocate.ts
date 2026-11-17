/** Pure allocate helpers shared by AlloyMixPanel UI + unit tests. */

export function formatInputComponents(
  components: Array<{ name?: string; label?: string; gross?: number }> | null | undefined,
): string {
  if (!Array.isArray(components) || !components.length) return ''
  return components
    .map((row) => {
      const name = String(row?.name || row?.label || '').trim()
      const gross = Number(row?.gross)
      if (!name || !(gross > 0)) return ''
      const g = Math.round(gross * 1000) / 1000
      return `${name}: ${g} g`
    })
    .filter(Boolean)
    .join(' · ')
}

export function resolveAllocateWeight(availableRaw: unknown, typedRaw: unknown): {
  available: number
  weight: number
  error?: string
} {
  const available = Number(availableRaw) || 0
  const typed = Number(typedRaw)
  const weight = Number.isFinite(typed) && typed > 0 ? typed : available
  if (weight > available + 0.0005) {
    return { available, weight, error: `Only ${available} g available` }
  }
  return { available, weight }
}

/** Payload fields beyond mixId / toDepartment. */
export function buildAllocateWeightPayload(available: number, weight: number): { weight?: number } {
  return weight + 0.0005 < available ? { weight } : {}
}

export function formatAllocateSuccess(opts: {
  partial?: boolean
  pendingReceive?: boolean
  fromCode: string
  destLabel: string
  weight: number
  childMixCode?: string
  parentRemaining?: number | string
}): string {
  const wait = opts.pendingReceive ? ' — waiting for receive Approve' : ''
  if (opts.partial && opts.childMixCode) {
    return (
      `Split ${opts.weight} g → ${opts.destLabel} as ${opts.childMixCode}`
      + ` · ${opts.fromCode} keeps ${opts.parentRemaining ?? '—'} g${wait}`
    )
  }
  return `Allocated ${opts.fromCode} (${opts.weight} g) → ${opts.destLabel}${wait}`
}
