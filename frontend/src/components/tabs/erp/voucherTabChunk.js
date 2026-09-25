/**
 * Shared dynamic import for VoucherTab so lazy() and prefetch hit the same chunk.
 */
export function importVoucherTab() {
  return import('../VoucherTab')
}

let voucherTabPrefetchStarted = false

/** Fire-and-forget prefetch; safe to call repeatedly. */
export function prefetchVoucherTabChunk() {
  if (voucherTabPrefetchStarted) return
  voucherTabPrefetchStarted = true
  void importVoucherTab().catch(() => {
    voucherTabPrefetchStarted = false
  })
}
