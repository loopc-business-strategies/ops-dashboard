import React from 'react'
import { isPrimaryNavClick } from '../../utils/dashboardNavigation'

/** Vertical rhythm between major blocks (matches ERP inner spacing). */
export const MODULE_TAB_GAP = '1.25rem'

export const ERP_INK = 'var(--text-primary)'
export const ERP_INK_SOFT = 'var(--text-secondary)'

const pillIdle = {
  padding: '0.55rem 1.1rem',
  borderRadius: '999px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  fontWeight: 600,
  transition: 'var(--transition)',
  whiteSpace: 'nowrap',
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text-secondary)',
}

const pillActive = {
  background: 'var(--brand-soft)',
  color: 'var(--brand-on-soft)',
  border: '1px solid var(--brand-border)',
  fontWeight: 700,
  boxShadow: 'none',
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
          if (!isPrimaryNavClick(event)) return
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
