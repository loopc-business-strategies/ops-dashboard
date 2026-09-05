import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

/**
 * Virtualized scroll list for large option/statement lists.
 * Preserves selection behavior via renderRow.
 */
export function VirtualScrollList({
  count,
  estimateSize = 34,
  overscan = 10,
  maxHeight = 300,
  renderRow,
  style = {},
}) {
  const parentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: typeof estimateSize === 'function' ? estimateSize : () => estimateSize,
    overscan,
  })

  return (
    <div
      ref={parentRef}
      style={{
        maxHeight,
        overflowY: 'auto',
        position: 'relative',
        ...style,
      }}
    >
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderRow(virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default VirtualScrollList
