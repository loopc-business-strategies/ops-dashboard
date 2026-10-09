import React, { useEffect, useRef, useState } from 'react'
import { NavItem } from './navConfig'
import { NAV_SECTIONS, dragShift, orderSections } from './navLayout'

/**
 * Follows the pointer with translateY and slides the other rows aside.
 * The new order is applied once, on release, so the row does not jump under the cursor.
 */
function usePointerReorder(onCommit) {
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  const dragRef = useRef(null)
  const [drag, setDrag] = useState(null)

  useEffect(() => () => dragRef.current?.stopListening?.(), [])

  const begin = (index, clientY, slot, count) => {
    if (dragRef.current) return
    const state = {
      index,
      startY: clientY,
      dy: 0,
      slot: slot || 40,
      count,
      shifts: Array.from({ length: count }, () => 0),
      to: index,
    }
    const move = (e) => {
      const current = dragRef.current
      if (!current) return
      const dy = e.clientY - current.startY
      const slots = current.slot > 0 ? Math.round(dy / current.slot) : 0
      const { shifts, to } = dragShift(current.count, current.index, slots)
      const next = { ...current, dy, shifts, to }
      dragRef.current = next
      setDrag(next)
    }
    const finish = (commit) => {
      const current = dragRef.current
      current?.stopListening?.()
      dragRef.current = null
      setDrag(null)
      if (commit && current && current.to !== current.index) commitRef.current(current.index, current.to)
    }
    const up = () => finish(true)
    const cancel = () => finish(false)
    state.stopListening = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    dragRef.current = state
    setDrag(state)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  const rowMotion = (index) => {
    if (!drag) return { className: '', style: undefined }
    if (index === drag.index) {
      return { className: ' sidebar-row--dragging', style: { transform: `translateY(${drag.dy}px)` } }
    }
    const slots = drag.shifts[index] || 0
    if (!slots) return { className: '', style: undefined }
    return { className: ' sidebar-row--shift', style: { transform: `translateY(${slots * drag.slot}px)` } }
  }

  return { begin, rowMotion }
}

function DragHandle({ label, onDragStart, onMoveBy }) {
  return (
    <button
      type="button"
      className="sidebar-drag-handle"
      aria-label={`Drag ${label} to change its position`}
      title="Drag to change position"
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        onDragStart(e.clientY)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        e.preventDefault()
        onMoveBy(e.key === 'ArrowUp' ? -1 : 1)
      }}
    >
      ☰
    </button>
  )
}

/** Items of one section; the ☰ drags within this section only. */
function DraggableItems({ items, onReorder, onMoveBy }) {
  const rowRefs = useRef({})
  const { begin, rowMotion } = usePointerReorder((from, to) => {
    onReorder(items.map((item) => item.id), from, to)
  })

  return items.map((item, index) => {
    const motion = rowMotion(index)
    return (
      <div
        key={item.id}
        ref={(el) => { rowRefs.current[item.id] = el }}
        className={`sidebar-item sidebar-item--edit${motion.className}`}
        style={motion.style}
      >
        <DragHandle
          label={item.label}
          onDragStart={(clientY) => begin(index, clientY, rowRefs.current[item.id]?.offsetHeight, items.length)}
          onMoveBy={(delta) => onMoveBy(items.map((row) => row.id), index, delta)}
        />
        <span className="sidebar-item-label truncate">{item.label}</span>
      </div>
    )
  })
}

/** Customize view: ☰ on each section moves the whole block, ☰ on each item moves it inside the section. */
function CustomizeSections({ ordered, config, groupOf, navLayout }) {
  const blockRefs = useRef({})
  const { begin, rowMotion } = usePointerReorder((from, to) => {
    navLayout.reorderSection(ordered, from, to)
  })

  return (
    <>
      <p className="sidebar-customize-title">Customize navigation</p>
      {ordered.map((key, index) => {
        const section = config[key]
        const motion = rowMotion(index)
        return (
          <div
            key={key}
            ref={(el) => { blockRefs.current[key] = el }}
            className={`sidebar-section-block${motion.className}`}
            style={motion.style}
          >
            {index > 0 ? <div className="sidebar-divider" role="separator" /> : null}
            <div className="sidebar-section--edit">
              <DragHandle
                label={`${section.title} section`}
                onDragStart={(clientY) => begin(index, clientY, blockRefs.current[key]?.offsetHeight, ordered.length)}
                onMoveBy={(delta) => navLayout.moveSection(ordered, index, delta)}
              />
              <span className="sidebar-section-label">{section.title}</span>
            </div>
            <DraggableItems
              items={section.items}
              onReorder={(ids, from, to) => navLayout.reorderItem(groupOf[key], ids, from, to)}
              onMoveBy={(ids, itemIndex, delta) => navLayout.moveItem(groupOf[key], ids, itemIndex, delta)}
            />
          </div>
        )
      })}
    </>
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

    if (editing) {
      return (
        <CustomizeSections ordered={ordered} config={config} groupOf={groupOf} navLayout={navLayout} />
      )
    }

    return ordered.map((key, sectionIndex) => {
      const section = config[key]
      return (
        <React.Fragment key={key}>
          {sectionIndex > 0 && <div className="sidebar-divider" role="separator" />}
          <button
            type="button"
            className="sidebar-section-title w-full"
            onClick={() => section.setOpen?.((v) => !v)}
            aria-expanded={section.open}
          >
            <span>{section.title}</span>
            <span className="section-chevron" aria-hidden="true">{section.open ? '▴' : '▾'}</span>
          </button>
          {section.open && section.items.map((item) => renderNavItem(key, item))}
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
