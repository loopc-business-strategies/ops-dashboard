import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

const DEFAULT_THRESHOLD = 80

/**
 * Hook for virtualizing table rows inside a scrollable container.
 * Returns scrollRef (attach to overflow parent) and row window metadata.
 */
export function useVirtualTableRows(rowCount, {
  estimateSize = 52,
  overscan = 8,
  threshold = DEFAULT_THRESHOLD,
} = {}) {
  const scrollRef = useRef(null)
  const enabled = rowCount > threshold
  const virtualizer = useVirtualizer({
    count: enabled ? rowCount : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
  })

  if (!enabled) {
    return {
      scrollRef,
      enabled: false,
      virtualItems: null,
      paddingTop: 0,
      paddingBottom: 0,
      totalSize: 0,
    }
  }

  const items = virtualizer.getVirtualItems()
  const paddingTop = items.length ? items[0].start : 0
  const paddingBottom = items.length
    ? virtualizer.getTotalSize() - items[items.length - 1].end
    : 0

  return {
    scrollRef,
    enabled: true,
    virtualItems: items,
    paddingTop,
    paddingBottom,
    totalSize: virtualizer.getTotalSize(),
  }
}

export default useVirtualTableRows
