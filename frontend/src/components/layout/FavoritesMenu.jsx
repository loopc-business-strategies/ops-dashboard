import { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { navigateFromNavItemId, resolveNavItemPresentation } from '../../utils/navItemPresentation'

const RECENT_DISPLAY_LIMIT = 5

function StarIcon({ filled = false, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.5l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 20l1-6L3.3 9.9l6-.9L12 3.5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EmptyBlock({ icon, title, hint }) {
  return (
    <div className="favorites-menu-empty">
      {icon ? <span className="favorites-menu-empty-icon" aria-hidden="true">{icon}</span> : null}
      <p className="favorites-menu-empty-title">{title}</p>
      {hint ? <p className="favorites-menu-empty-hint">{hint}</p> : null}
    </div>
  )
}

/**
 * Topbar Favorites dropdown with favorites + recently used.
 */
export default function FavoritesMenu({
  navItems = [],
  favorites = [],
  recent = [],
  onToggleFavorite,
  onReorderFavorites,
  onClearRecent,
  onNavigateToTab,
}) {
  const { t, isRTL } = useLanguage()
  const [open, setOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [dropIndex, setDropIndex] = useState(null)
  const rootRef = useRef(null)

  const favoriteRows = useMemo(() => (
    (favorites || [])
      .map((f) => resolveNavItemPresentation(f.navItemId, navItems))
      .filter((row) => row.authorized)
  ), [favorites, navItems])

  const recentRows = useMemo(() => (
    (recent || [])
      .map((r) => resolveNavItemPresentation(r.navItemId, navItems))
      .filter((row) => row.authorized)
      .slice(0, RECENT_DISPLAY_LIMIT)
  ), [recent, navItems])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openItem = (navItemId) => {
    navigateFromNavItemId(navItemId, onNavigateToTab, navItems)
    setOpen(false)
  }

  const clearDragState = () => {
    setDragIndex(null)
    setDropIndex(null)
  }

  const onDropReorder = (toIndex) => {
    if (dragIndex == null || dragIndex === toIndex) {
      clearDragState()
      return
    }
    const ids = favoriteRows.map((row) => row.navItemId)
    const next = [...ids]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(toIndex, 0, moved)
    clearDragState()
    onReorderFavorites?.(next)
  }

  const handleClearRecent = () => {
    if (!window.confirm(t('confirmClearRecent'))) return
    onClearRecent?.()
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="topbar-icon-btn"
        aria-label={t('favorites')}
        title={t('favorites')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          background: open ? 'var(--brand-soft)' : undefined,
          borderColor: open ? 'var(--brand-border)' : undefined,
          color: open ? 'var(--brand-primary)' : 'var(--text-secondary)',
        }}
      >
        <StarIcon filled={favoriteRows.length > 0} />
      </button>

      {open ? (
        <div
          className="topbar-dropdown favorites-menu absolute mt-1 py-2 rounded-xl shadow-2xl"
          style={{ [isRTL ? 'left' : 'right']: 0, width: 320, maxWidth: 'min(320px, 92vw)' }}
          role="menu"
        >
          <div className="favorites-menu-head">
            <p className="favorites-menu-section-title">{t('favorites')}</p>
            <p className="favorites-menu-section-hint">{t('favoritesMenuHint')}</p>
          </div>

          {favoriteRows.length === 0 ? (
            <EmptyBlock
              icon={<StarIcon size={18} />}
              title={t('favoritesEmpty')}
              hint={t('manageFavoritesHint')}
            />
          ) : (
            <ul className="favorites-menu-list">
              {favoriteRows.map((row, index) => (
                <li
                  key={row.navItemId}
                  className={[
                    'favorites-menu-row',
                    dragIndex === index ? 'is-dragging' : '',
                    dropIndex === index && dragIndex != null && dragIndex !== index ? 'is-drop-target' : '',
                  ].filter(Boolean).join(' ')}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (dropIndex !== index) setDropIndex(index)
                  }}
                  onDrop={() => onDropReorder(index)}
                >
                  <button
                    type="button"
                    className="favorites-menu-drag"
                    draggable
                    title={t('favoritesDragHint')}
                    aria-label={t('favoritesDragHint')}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      setDragIndex(index)
                      setDropIndex(index)
                    }}
                    onDragEnd={clearDragState}
                  >
                    ☰
                  </button>
                  <button
                    type="button"
                    className="favorites-menu-item"
                    onClick={() => openItem(row.navItemId)}
                  >
                    <span className="favorites-menu-icon" aria-hidden="true">{row.icon}</span>
                    <span className="favorites-menu-label truncate">{row.label}</span>
                  </button>
                  <button
                    type="button"
                    className="favorites-menu-remove"
                    aria-label={t('removeFromFavorites')}
                    title={t('removeFromFavorites')}
                    onClick={() => onToggleFavorite?.(row.navItemId)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="favorites-menu-divider" />

          <div className="favorites-menu-head favorites-menu-head--row">
            <p className="favorites-menu-section-title">{t('recentlyUsed')}</p>
            {recentRows.length > 0 ? (
              <button type="button" className="favorites-menu-clear" onClick={handleClearRecent}>
                {t('clearRecent')}
              </button>
            ) : null}
          </div>

          {recentRows.length === 0 ? (
            <EmptyBlock
              title={t('recentEmpty')}
              hint={t('recentEmptyHint')}
            />
          ) : (
            <ul className="favorites-menu-list favorites-menu-list--recent">
              {recentRows.map((row) => (
                <li key={`recent-${row.navItemId}`} className="favorites-menu-row">
                  <button
                    type="button"
                    className="favorites-menu-item favorites-menu-item--flush"
                    onClick={() => openItem(row.navItemId)}
                  >
                    <span className="favorites-menu-icon" aria-hidden="true">{row.icon}</span>
                    <span className="favorites-menu-label truncate">{row.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
