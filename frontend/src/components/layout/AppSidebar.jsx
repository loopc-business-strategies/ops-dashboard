import React from 'react'
import { NavItem } from './navConfig'

/**
 * Branded enterprise sidebar — preserves all existing nav groups/items.
 */
export default function AppSidebar({
  branding,
  t,
  isRTL,
  isDesktop: _isDesktop,
  sidebarOpen,
  mainItems,
  adminItems,
  deptItems,
  erpItems,
  adminOpen,
  setAdminOpen,
  deptOpen,
  setDeptOpen,
  erpOpen,
  setErpOpen,
  activeTab,
  erpSubTab,
  buildNavHref,
  sidebarLinkAfterClick,
  prefetchTabChunk,
  onLogout,
  onErpNavigate,
}) {
  return (
    <aside
      className={`sidebar fixed inset-y-0 z-50 flex flex-col transform transition-transform duration-300 ease-in-out
        ${isRTL ? 'right-0' : 'left-0'}
        ${sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
      `}
      aria-label="Main navigation"
    >
      <div className="sidebar-logo flex-shrink-0">
        <div className="sidebar-logo-plate">
          {branding.logoImage ? (
            <img
              src={branding.logoImage}
              alt={`${branding.displayName} logo`}
              decoding="async"
            />
          ) : (
            <span style={{ color: 'var(--brand-dark)', fontWeight: 800, fontSize: 14 }}>
              {branding.logoText}
            </span>
          )}
        </div>
        <div className="sidebar-logo-text min-w-0">
          <p className="sidebar-logo-title truncate">{branding.displayName}</p>
          <p className="sidebar-logo-sub truncate">{t('controlSystem')}</p>
        </div>
      </div>

      <nav className="sidebar-nav flex-1 overflow-y-auto" aria-label="Modules">
        {mainItems.map((item) => (
          <NavItem
            key={item.id}
            {...item}
            href={buildNavHref(item)}
            active={activeTab === item.id}
            onAfterClick={sidebarLinkAfterClick}
            onPrefetch={() => prefetchTabChunk(item.id)}
          />
        ))}

        {adminItems.length > 0 && <div className="sidebar-divider" />}

        {adminItems.length > 0 && (
          <>
            <button
              type="button"
              className="sidebar-section-title w-full"
              onClick={() => setAdminOpen((v) => !v)}
            >
              <span>{t('adminSection')}</span>
              <span className="section-chevron">{adminOpen ? '▴' : '▾'}</span>
            </button>
            {adminOpen && adminItems.map((item) => (
              <NavItem
                key={item.id}
                {...item}
                href={buildNavHref(item)}
                active={activeTab === item.id}
                onAfterClick={sidebarLinkAfterClick}
                onPrefetch={() => prefetchTabChunk(item.id)}
              />
            ))}
          </>
        )}

        {deptItems.length > 0 && <div className="sidebar-divider" />}

        {deptItems.length > 0 && (
          <>
            <button
              type="button"
              className="sidebar-section-title w-full"
              onClick={() => setDeptOpen((v) => !v)}
            >
              <span>{t('departments')}</span>
              <span className="section-chevron">{deptOpen ? '▴' : '▾'}</span>
            </button>
            {deptOpen && deptItems.map((item) => (
              <NavItem
                key={item.id}
                {...item}
                href={buildNavHref(item)}
                active={activeTab === item.id}
                onAfterClick={sidebarLinkAfterClick}
                onPrefetch={() => prefetchTabChunk(item.id)}
              />
            ))}
          </>
        )}

        {erpItems.length > 0 && <div className="sidebar-divider" />}

        {erpItems.length > 0 && (
          <>
            <button
              type="button"
              className="sidebar-section-title w-full"
              onClick={() => setErpOpen((v) => !v)}
            >
              <span>ERP</span>
              <span className="section-chevron">{erpOpen ? '▴' : '▾'}</span>
            </button>
            {erpOpen && erpItems.map((item) => (
              <NavItem
                key={item.id}
                {...item}
                href={buildNavHref(item)}
                active={activeTab === 'erp' && erpSubTab === item.erpSub}
                openInNewTab={false}
                onSameTabNavigate={() => onErpNavigate?.(item.erpSub)}
                onAfterClick={sidebarLinkAfterClick}
                onPrefetch={() => prefetchTabChunk('erp')}
              />
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer flex-shrink-0">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ color: 'var(--sidebar-fg-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t('signOut')}
        </button>
      </div>
    </aside>
  )
}
