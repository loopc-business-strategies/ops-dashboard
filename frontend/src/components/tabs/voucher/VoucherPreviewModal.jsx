import { memo, useEffect, useMemo, useRef, useState } from 'react'
import VoucherPrintPanel from './VoucherPrintPanel'
import { VOUCHER_PREVIEW_TYPES } from './voucherPreviewSamples'

function VoucherPreviewModal({
  open,
  onClose,
  title = 'Voucher Preview',
  printModel,
  mode = 'live',
  voucherType = 'payment',
  previewMode = 'empty',
  onVoucherTypeChange,
  onPreviewModeChange,
  onPrint,
}) {
  const panelRef = useRef(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const dragSessionRef = useRef(null)
  const moveHandlerRef = useRef(null)
  const upHandlerRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const isSettingsMode = mode === 'settings'
  const resolvedTitle = useMemo(() => {
    if (!isSettingsMode) return title
    const typeLabel = VOUCHER_PREVIEW_TYPES.find((item) => item.key === voucherType)?.label || 'Voucher'
    const modeLabel = previewMode === 'sample' ? 'Sample' : 'Empty'
    return `${typeLabel} — ${modeLabel} Preview`
  }, [isSettingsMode, previewMode, title, voucherType])

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
    if (event.target.closest('button, select, label, input')) return
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
    const onDragEnd = () => stopDrag()
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

  useEffect(() => () => cleanupDragListeners(), [])

  if (!open || !printModel) return null

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
          <span style={{ fontWeight: '700', fontSize: '1.05rem' }}>{resolvedTitle}</span>
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

        {isSettingsMode ? (
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '12px 16px',
            borderBottom: '1px solid #E5E7EB',
            background: '#F8FAFC',
          }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
              Voucher type
              <select
                value={voucherType}
                onChange={(e) => onVoucherTypeChange?.(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
              >
                {VOUCHER_PREVIEW_TYPES.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
            <div style={{ display: 'inline-flex', border: '1px solid #D1D5DB', borderRadius: '8px', overflow: 'hidden' }}>
              {['empty', 'sample'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onPreviewModeChange?.(value)}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    background: previewMode === value ? '#005B96' : '#FFFFFF',
                    color: previewMode === value ? '#FFFFFF' : '#374151',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {value === 'empty' ? 'Empty' : 'Sample'}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ flex: 1, overflow: 'auto', background: '#F3F4F6', padding: '16px' }}>
          <VoucherPrintPanel printModel={printModel} renderMode="preview" />
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
          <button
            type="button"
            onClick={() => (onPrint ? onPrint() : window.print())}
            style={{
              padding: '0.6rem 1.2rem',
              background: '#005B96',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              cursor: 'pointer',
              fontWeight: '700',
            }}
          >
            Print
          </button>
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

export default memo(VoucherPreviewModal)
