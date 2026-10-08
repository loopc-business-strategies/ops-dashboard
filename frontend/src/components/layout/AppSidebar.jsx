import React from 'react'
import { NavItem } from './navConfig'
import { NAV_SECTIONS, orderSections } from './navLayout'

function MoveButtons({ label, index, count, onMove }) {
  return (
    <span className="sidebar-move">
      <button
        type="button"
        className="sidebar-move-btn"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        ▲
      </button>
      <button
        type="button"
        className="sidebar-move-btn"
        aria-label={`Move ${label} down`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        ▼
      </button>
    </span>
  )
}

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
  onModuleNavigate,
  onMouseEnter,
  onMouseLeave,
  customizable = false,
  navLayout = null,
  workspaceOpen = true,
  setWorkspaceOpen,
}) {
  const editing = Boolean(customizable && navLayout?.editing)

  const renderNavItem = (sectionKey, item) => {
    if (sectionKey === 'erp') {
      return (
        <NavItem
          key={item.id}
          {...item}
          href={buildNavHref(item)}
          active={activeTab === 'erp' && erpSubTab === item.erpSub}
          openInNewTab={false}
          onSameTabNavigate={() => onErpNavigate?.(item.erpSub)}
          onAfterClick={sidebarLinkAfterClick}
          onPrefetch={() => {
            prefetchTabChunk('erp')
            prefetchTabChunk(item.id)
          }}
        />
      )
    }
    return (
      <NavItem
        key={item.id}
        {...item}
        href={buildNavHref(item)}
        active={activeTab === item.id}
        openInNewTab={sectionKey === 'departments' && item.id === 'production-new'}
        onSameTabNavigate={() => onModuleNavigate?.(item.id)}
        onAfterClick={sidebarLinkAfterClick}
        onPrefetch={() => prefetchTabChunk(item.id)}
      />
    )
  }

  const renderCustomSections = () => {
    const config = {
      workspace: { title: 'Workspace', items: mainItems, open: workspaceOpen, setOpen: setWorkspaceOpen },
      departments: { title: t('departments'), items: deptItems, open: deptOpen, setOpen: setDeptOpen },
      erp: { title: 'ERP', items: erpItems, open: erpOpen, setOpen: setErpOpen },
      admin: { title: t('adminSection'), items: adminItems, open: adminOpen, setOpen: setAdminOpen },
    }
    const available = NAV_SECTIONS.map((s) => s.key).filter((key) => config[key].items.length > 0)
    const ordered = orderSections(navLayout?.layout?.sections, available)
    const groupOf = Object.fromEntries(NAV_SECTIONS.map((s) => [s.key, s.group]))

    return ordered.map((key, sectionIndex) => {
      const section = config[key]
      const itemIds = section.items.map((item) => item.id)
      return (
        <React.Fragment key={key}>
          {sectionIndex > 0 && <div className="sidebar-divider" role="separator" />}
          <div className="sidebar-section-head">
            <button
              type="button"
              className="sidebar-section-title w-full"
              onClick={() => section.setOpen?.((v) => !v)}
              aria-expanded={section.open}
            >
              <span>{section.title}</span>
              <span className="section-chevron" aria-hidden="true">{section.open ? '▴' : '▾'}</span>
            </button>
            {editing ? (
              <MoveButtons
                label={section.title}
                index={sectionIndex}
                count={ordered.length}
                onMove={(delta) => navLayout.moveSection(ordered, sectionIndex, delta)}
              />
            ) : null}
          </div>
          {section.open && section.items.map((item, itemIndex) => (editing ? (
            <div key={item.id} className="sidebar-item sidebar-item--edit">
              <span className="sidebar-item-label truncate">{item.label}</span>
              <MoveButtons
                label={item.label}
                index={itemIndex}
                count={itemIds.length}
                onMove={(delta) => navLayout.moveItem(groupOf[key], itemIds, itemIndex, delta)}
              />
            </div>
          ) : renderNavItem(key, item)))}
        </React.Fragment>
      )
    })
  }

  return (
    <aside
      className={`sidebar fixed inset-y-0 z-50 flex flex-col transform transition-transform duration-300 ease-in-out
        ${isRTL ? 'right-0' : 'left-0'}
        ${sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
      `}
      aria-label="Main navigation"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
        {customizable ? renderCustomSections() : (
        <>
        {mainItems.length > 0 ? (
          <p className="sidebar-section-label" id="sidebar-workspace-label">Workspace</p>
        ) : null}
        <div role="group" aria-labelledby={mainItems.length ? 'sidebar-workspace-label' : undefined}>
          {mainItems.map((item) => (
            <NavItem
              key={item.id}
              {...item}
              href={buildNavHref(item)}
              active={activeTab === item.id}
              onSameTabNavigate={() => onModuleNavigate?.(item.id)}
              onAfterClick={sidebarLinkAfterClick}
              onPrefetch={() => prefetchTabChunk(item.id)}
            />
          ))}
        </div>

        {deptItems.length > 0 && <div className="sidebar-divider" role="separator" />}

        {deptItems.length > 0 && (
          <>
            <button
              type="button"
              className="sidebar-section-title w-full"
              onClick={() => setDeptOpen((v) => !v)}
              aria-expanded={deptOpen}
            >
              <span>{t('departments')}</span>
              <span className="section-chevron" aria-hidden="true">{deptOpen ? '▴' : '▾'}</span>
            </button>
            {deptOpen && deptItems.map((item) => (
              <NavItem
                key={item.id}
                {...item}
                href={buildNavHref(item)}
                active={activeTab === item.id}
                openInNewTab={item.id === 'production-new'}
                onSameTabNavigate={() => onModuleNavigate?.(item.id)}
                onAfterClick={sidebarLinkAfterClick}
                onPrefetch={() => prefetchTabChunk(item.id)}
              />
            ))}
          </>
        )}

        {erpItems.length > 0 && <div className="sidebar-divider" role="separator" />}

        {erpItems.length > 0 && (
          <>
            <button
              type="button"
              className="sidebar-section-title w-full"
              onClick={() => setErpOpen((v) => !v)}
              aria-expanded={erpOpen}
            >
              <span>ERP</span>
              <span className="section-chevron" aria-hidden="true">{erpOpen ? '▴' : '▾'}</span>
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
                onPrefetch={() => {
                  prefetchTabChunk('erp')
                  prefetchTabChunk(item.id)
                }}
              />
            ))}
          </>
        )}

        {adminItems.length > 0 && <div className="sidebar-divider" role="separator" />}

        {adminItems.length > 0 && (
          <>
            <button
              type="button"
              className="sidebar-section-title w-full"
              onClick={() => setAdminOpen((v) => !v)}
              aria-expanded={adminOpen}
            >
              <span>{t('adminSection')}</span>
              <span className="section-chevron" aria-hidden="true">{adminOpen ? '▴' : '▾'}</span>
            </button>
            {adminOpen && adminItems.map((item) => (
              <NavItem
                key={item.id}
                {...item}
                href={buildNavHref(item)}
                active={activeTab === item.id}
                onSameTabNavigate={() => onModuleNavigate?.(item.id)}
                onAfterClick={sidebarLinkAfterClick}
                onPrefetch={() => prefetchTabChunk(item.id)}
              />
            ))}
          </>
        )}
        </>
        )}
      </nav>

      {customizable && navLayout ? (
        <div className="sidebar-customize flex-shrink-0">
          {navLayout.error ? <p className="sidebar-customize-error" role="alert">{navLayout.error}</p> : null}
          {editing ? (
            <div className="sidebar-customize-row">
              <button type="button" className="sidebar-customize-btn" onClick={navLayout.reset} disabled={navLayout.saving}>
                Reset to default
              </button>
              <button
                type="button"
                className="sidebar-customize-btn sidebar-customize-btn--primary"
                onClick={navLayout.save}
                disabled={navLayout.saving}
              >
                {navLayout.saving ? 'Saving…' : 'Done'}
              </button>
            </div>
          ) : (
            <button type="button" className="sidebar-customize-btn" onClick={navLayout.startEdit}>
              Customize sidebar
            </button>
          )}
        </div>
      ) : null}

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
