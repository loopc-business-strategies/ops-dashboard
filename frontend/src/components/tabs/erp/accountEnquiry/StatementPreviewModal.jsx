import { memo, useEffect, useRef, useState } from 'react'

function StatementPreviewModal({
  open,
  onClose,
  title,
  html,
  loading,
  showPrintButton = false,
  onPrint,
}) {
  const panelRef = useRef(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const dragSessionRef = useRef(null)
  const moveHandlerRef = useRef(null)
  const upHandlerRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const applyPanelTransform = () => {
    const panel = panelRef.current
    if (!panel) return
    const { x, y } = offsetRef.current
    panel.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  const cleanupDragListeners = () => {
    if (moveHandlerRef.current) {
      window.removeEventListener('mousemove', moveHandlerRef.current)
      moveHandlerRef.current = null
    }
    if (upHandlerRef.current) {
      window.removeEventListener('mouseup', upHandlerRef.current)
      upHandlerRef.current = null
    }
    dragSessionRef.current = null
    document.body.style.removeProperty('user-select')
  }

  const stopDrag = () => {
    cleanupDragListeners()
    setIsDragging(false)
  }

  const beginModalDrag = (event) => {
    if (event.button !== 0) return
    if (event.target.closest('button')) return
    event.preventDefault()
    cleanupDragListeners()
    dragSessionRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startOffsetX: offsetRef.current.x,
      startOffsetY: offsetRef.current.y,
    }
    const onDragMove = (moveEvent) => {
      const session = dragSessionRef.current
      if (!session) return
      offsetRef.current = {
        x: session.startOffsetX + (moveEvent.clientX - session.pointerX),
        y: session.startOffsetY + (moveEvent.clientY - session.pointerY),
      }
      applyPanelTransform()
    }
    const onDragEnd = () => {
      stopDrag()
    }
    moveHandlerRef.current = onDragMove
    upHandlerRef.current = onDragEnd
    setIsDragging(true)
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
  }

  useEffect(() => {
    if (open) return undefined
    offsetRef.current = { x: 0, y: 0 }
    if (panelRef.current) {
      panelRef.current.style.transform = ''
      panelRef.current.style.willChange = ''
    }
    cleanupDragListeners()
    setIsDragging(false)
    return undefined
  }, [open])

  useEffect(() => () => {
    cleanupDragListeners()
  }, [])

  const handlePrint = () => {
    if (onPrint) {
      onPrint()
      return
    }
    if (!html) return
    const printWindow = window.open('', '_blank', 'noopener,noreferrer')
    if (!printWindow) return
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    printWindow.close()
  }

  if (!open) return null

  const backdropColor = isDragging ? 'rgba(15, 23, 42, 0.12)' : 'rgba(15, 23, 42, 0.45)'

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !isDragging) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: backdropColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        ref={panelRef}
        style={{
          background: '#fff',
          borderRadius: '8px',
          width: 'min(1200px, 96vw)',
          height: 'min(88vh, 900px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 42px rgba(0,0,0,0.35)',
          willChange: isDragging ? 'transform' : undefined,
        }}
      >
        <div
          onMouseDown={beginModalDrag}
          style={{
            background: '#0F172A',
            color: '#FFFFFF',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            flexShrink: 0,
            touchAction: 'none',
          }}
        >
          <span style={{ fontWeight: '700', fontSize: '1.05rem' }}>{title}</span>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => onClose()}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontSize: '20px',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: '#F9FAFB' }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#374151',
              fontSize: '0.95rem',
            }}
            >
              Preparing statement…
            </div>
          ) : (
            <iframe
              title="Statement preview"
              srcDoc={html}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
                background: '#FFFFFF',
                pointerEvents: isDragging ? 'none' : 'auto',
              }}
            />
          )}
        </div>
        <div style={{
          background: '#F9FAFB',
          borderTop: '1px solid #E5E7EB',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          flexShrink: 0,
        }}
        >
          {showPrintButton ? (
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !html}
              style={{
                padding: '0.6rem 1.2rem',
                background: '#005B96',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                cursor: loading || !html ? 'not-allowed' : 'pointer',
                fontWeight: '700',
                opacity: loading || !html ? 0.65 : 1,
              }}
            >
              Print
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onClose()}
            style={{
              padding: '0.6rem 1.2rem',
              background: '#6B7280',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              cursor: 'pointer',
              fontWeight: '700',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(StatementPreviewModal)
