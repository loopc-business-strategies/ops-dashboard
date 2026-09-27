import type { MetalBatchEdit } from './MetalProcessPanel'

export type CaptureSide = 'in' | 'out'

export type PendingFill = {
  side: CaptureSide
  /** Display text for the Qty cell, e.g. "1250.35 g". */
  qty: string
  /** ISO time the weight was confirmed. */
  at: string
}

let pending: PendingFill | null = null

/** Hand a confirmed camera weight from the capture screen back to the dashboard. */
export function setPendingFill(fill: PendingFill) {
  pending = fill
}

/** Returns the pending weight once, then clears it. */
export function takePendingFill(): PendingFill | null {
  const fill = pending
  pending = null
  return fill
}

/**
 * Writes the weight into the first empty Qty cell (batch order, then line order) and stamps its Time.
 * Never overwrites a filled cell; `filled` is false when the table has no empty Qty left.
 */
export function fillNextQty(
  batches: MetalBatchEdit[],
  qty: string,
  time: string,
): { batches: MetalBatchEdit[]; filled: boolean } {
  for (let bi = 0; bi < batches.length; bi += 1) {
    const li = batches[bi].lines.findIndex((line) => !line.qty.trim())
    if (li === -1) continue
    const next = batches.map((batch, i) =>
      i !== bi
        ? batch
        : { ...batch, lines: batch.lines.map((line, j) => (j === li ? { ...line, qty, time } : line)) },
    )
    return { batches: next, filled: true }
  }
  return { batches, filled: false }
}
