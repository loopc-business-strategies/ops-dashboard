import React from 'react'

/** Vertical rhythm between major blocks (matches ERP inner spacing). */
export const MODULE_TAB_GAP = '1.25rem'

export const ERP_INK = '#111827'
export const ERP_INK_SOFT = '#374151'

const pillIdle = {
  padding: '0.625rem 1.25rem',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  fontWeight: 600,
  transition: 'all 0.25s ease',
  whiteSpace: 'nowrap',
  border: '1px solid #D1D5DB',
  background: 'transparent',
  color: '#1F1F1F',
}

const pillActive = {
  background: 'var(--purple-light)',
  color: '#FFFFFF',
  border: 'none',
  fontWeight: 700,
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
}

function handleSubTabNavClick(event, onClick) {
  if (onClick) onClick(event)
}

/**
 * ERP-style sub-tab button (same visual language as ERPTab internal tab pills).
 * When `href` is set, supports right-click / ctrl+click open in new tab.
 */
export function ErpSubTabButton({
  active,
  children,
  onClick,
  href,
  style = {},
  type = 'button',
}) {
  const mergedStyle = { ...pillIdle, ...(active ? pillActive : {}), ...style, textDecoration: 'none', display: 'inline-block' }

  if (href) {
    return (
      <a
        href={href}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
          event.preventDefault()
          handleSubTabNavClick(event, onClick)
        }}
        style={mergedStyle}
      >
        {children}
      </a>
    )
  }

  return (
    <button type={type} onClick={onClick} style={mergedStyle}>
      {children}
    </button>
  )
}

/**
 * Standard column layout for main modules: consistent gap and full width.
 */
export function ModuleTabColumn({ children, className = '', style = {} }) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: MODULE_TAB_GAP,
        width: '100%',
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Page title + subtitle row (matches ERP dashboard section headers).
 */
export function ModulePageHeading({ title, subtitle, right }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h2 style={{ margin: 0, color: ERP_INK, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h2>
        {subtitle ? (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: ERP_INK_SOFT, maxWidth: 720 }}>{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  )
}

/**
 * Wraps a row of ERP sub-tab pills with optional trailing control (e.g. notification bell).
 */
export function ModuleSubTabRow({ children, right, style = {} }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
        marginBottom: '0.25rem',
        ...style,
      }}
    >
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
      {right}
    </div>
  )
}
