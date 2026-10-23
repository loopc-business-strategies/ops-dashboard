import { memo, useMemo } from 'react'
import {
  FLOATING_MODAL_FOOTER_END_PAD,
  FloatingModalResizeHandle,
  useFloatingModalChrome,
} from '../erp/useFloatingModalChrome'
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
  const {
    panelRef,
    offset,
    size,
    isDragging,
    isResizing,
    beginDrag,
    beginResize,
    canCloseOnBackdropClick,
  } = useFloatingModalChrome({
    open,
    persistKey: 'voucher-preview',
    defaultWidth: 1200,
    defaultHeightRatio: 0.88,
    minWidth: 640,
    minHeight: 360,
    maxHeight: 1400,
  })

  const isSettingsMode = mode === 'settings'
  const resolvedTitle = useMemo(() => {
    if (!isSettingsMode) return title
    const typeLabel = VOUCHER_PREVIEW_TYPES.find((item) => item.key === voucherType)?.label || 'Voucher'
    const modeLabel = previewMode === 'sample' ? 'Sample' : 'Empty'
    return `${typeLabel} — ${modeLabel} Preview`
  }, [isSettingsMode, previewMode, title, voucherType])

  if (!open || !printModel) return null

  const backdropColor = (isDragging || isResizing)
    ? 'rgba(15, 23, 42, 0.12)'
    : 'rgba(15, 23, 42, 0.45)'

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && canCloseOnBackdropClick()) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: backdropColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
        padding: '1rem',
      }}
    >
      <div
        ref={panelRef}
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: '8px',
          width: size.width,
          height: size.height,
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 42px rgba(0,0,0,0.35)',
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
      >
        <div
          onMouseDown={beginDrag}
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
            flexShrink: 0,
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
                    background: previewMode === value ? 'var(--purple)' : '#FFFFFF',
                    color: previewMode === value ? 'var(--brand-on-primary)' : '#374151',
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

        <div style={{ flex: 1, overflow: 'auto', background: '#F3F4F6', padding: '16px', minHeight: 0 }}>
          <VoucherPrintPanel printModel={printModel} renderMode="preview" />
        </div>

        <div style={{
          background: '#F9FAFB',
          borderTop: '1px solid #E5E7EB',
          padding: `1rem ${FLOATING_MODAL_FOOTER_END_PAD} 1rem 1.5rem`,
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
              background: 'var(--purple)',
              color: 'var(--brand-on-primary)',
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
        <FloatingModalResizeHandle onMouseDown={beginResize} />
      </div>
    </div>
  )
}

export default memo(VoucherPreviewModal)
