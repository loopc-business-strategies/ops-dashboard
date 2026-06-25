import { ERPDashboardTabContainer } from '../ERPTabContainers'
import { renderERP_DashWidget } from '../ERPDashboardWidgets'
import { ERP_DASH_DEFAULT, ERP_DASH_GRID_COLUMNS, ERP_DASH_WIDGET_COUNT, ensureMarginsThenFixingOrder } from '../../erpTabConstants'

export default function ERPDashboardTab({
  activeTab,
  C,
  dashWidgets,
  setDashWidgets,
  dashEditMode,
  setDashEditMode,
  dashHoveredWid,
  setDashHoveredWid,
  dashWidgetCols,
  setDashWidgetCols,
  dashCustomizeOpen,
  setDashCustomizeOpen,
  dashPickSelected,
  setDashPickSelected,
  dashDragSrc,
  ERP_DASH_ALL_WIDGETS,
  dashboard,
  dashChatMessages,
  setActiveTab,
  onNavigateMain,
  dashboardLiveRecalcEnabled = false,
}) {
  return (
    <>
      {/* DASHBOARD TAB */}
      <ERPDashboardTabContainer activeTab={activeTab}>
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>📊 My Dashboard</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: C.inkSoft }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {' · '}
                {dashWidgets.length === ERP_DASH_WIDGET_COUNT
                  ? `${ERP_DASH_WIDGET_COUNT} widgets`
                  : `${dashWidgets.length} of ${ERP_DASH_WIDGET_COUNT} widgets`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Arrange and Customize buttons only */}
              <button
                onClick={() => {
                  if (dashEditMode) {
                    setDashWidgets((prev) => ensureMarginsThenFixingOrder(prev))
                  }
                  setDashEditMode((v) => !v)
                }}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '600', border: `1px solid ${dashEditMode ? C.s1 : '#D1D5DB'}`, borderRadius: '0.375rem', background: dashEditMode ? '#DCFCE7' : C.p1, color: dashEditMode ? C.s2 : C.inkSoft, cursor: 'pointer' }}
              >
                ⠿ {dashEditMode ? 'Done' : 'Arrange'}
              </button>
              <button
                onClick={() => { setDashPickSelected([...dashWidgets]); setDashCustomizeOpen(true) }}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '600', border: 'none', borderRadius: '0.375rem', background: C.s1, color: '#fff', cursor: 'pointer' }}
              >
                + Customize
              </button>
            </div>
          </div>

          {/* Edit mode banner */}
          {dashEditMode && (
            <div style={{ background: 'linear-gradient(90deg,#DCFCE7,#F0FDF4)', border: `1px solid #A7F3D0`, borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: C.s2 }}>
              <span style={{ fontSize: '1rem' }}>↕</span>
              <span>Drag widgets to rearrange. Margins and fixing are pinned to the front when you click <strong>Done</strong> or <strong>Customize → Apply</strong>. Click <strong>✕</strong> to remove a widget.</span>
            </div>
          )}

          {/* Widget grid */}
          {dashWidgets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: C.p2, borderRadius: '0.75rem' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</p>
              <p style={{ color: C.inkSoft, fontSize: '0.9rem', marginBottom: '1rem' }}>No widgets on your dashboard yet.</p>
              <button
                onClick={() => { setDashPickSelected([...dashWidgets]); setDashCustomizeOpen(true) }}
                style={{ padding: '0.5rem 1.25rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
              >
                + Add Widgets
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${ERP_DASH_GRID_COLUMNS}, minmax(0, 1fr))`,
                gap: '0.875rem',
              }}
            >
              {dashWidgets.map((wid, idx) => {
                const meta = ERP_DASH_ALL_WIDGETS.find(w => w.id === wid)
                if (!meta) return null
                const rawCols = dashWidgetCols[wid] ?? meta.cols
                const span = Math.min(Math.max(Number(rawCols) || 1, 1), ERP_DASH_GRID_COLUMNS)
                const isHovered = dashHoveredWid === wid
                const edgeToEdge = wid === 'margins' || wid === 'apar' || wid === 'fixing'
                const widgetOptions = {
                  liveRecalcEnabled: dashboardLiveRecalcEnabled,
                }
                return (
                  <div
                    key={wid}
                    draggable={dashEditMode}
                    onDragStart={(e) => {
                      dashDragSrc.current = idx
                      try {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', String(idx))
                      } catch { void 0 }
                    }}
                    onDragOver={(e) => {
                      if (!dashEditMode) return
                      e.preventDefault()
                      try {
                        e.dataTransfer.dropEffect = 'move'
                      } catch { void 0 }
                    }}
                    onDragEnd={() => {
                      dashDragSrc.current = null
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (!dashEditMode) return
                      let src = dashDragSrc.current
                      if (src == null) {
                        try {
                          const parsed = Number(e.dataTransfer.getData('text/plain'))
                          if (!Number.isNaN(parsed)) src = parsed
                        } catch { void 0 }
                      }
                      if (src == null || src === idx) return
                      const next = [...dashWidgets]
                      const moved = next[src]
                      if (moved == null) return
                      next.splice(src, 1)
                      next.splice(idx, 0, moved)
                      setDashWidgets(next)
                      dashDragSrc.current = null
                    }}
                    onMouseEnter={() => setDashHoveredWid(wid)}
                    onMouseLeave={() => setDashHoveredWid(null)}
                    style={{
                      gridColumn: `span ${span}`,
                      background: C.p1,
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: dashEditMode ? `2px dashed #A7F3D0` : `1px solid #E5E7EB`,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                      cursor: dashEditMode ? 'grab' : 'default',
                      position: 'relative',
                    }}
                  >
                    {/* Drag handle overlay — visible on hover in edit mode */}
                    {dashEditMode && isHovered && (
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: '1.75rem', color: 'rgba(0,0,0,0.18)', pointerEvents: 'none', userSelect: 'none', zIndex: 2 }}>⠿</div>
                    )}
                    {/* Widget header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderBottom: '1px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '6px', background: meta.color || '#E8F5EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
                          {meta.icon}
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: C.ink }}>{meta.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: (isHovered || dashEditMode) ? 1 : 0, transition: 'opacity 0.15s' }}>
                        {meta.viewTab && (
                          <button
                            type="button"
                            draggable={false}
                            onDragStart={(ev) => ev.stopPropagation()}
                            onClick={() => setActiveTab(meta.viewTab)}
                            style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '5px', border: '1px solid #A7F3D0', background: '#F0FDF4', fontSize: '0.68rem', fontWeight: '500', color: C.s2, cursor: 'pointer' }}
                          >→ View</button>
                        )}
                        <button
                          type="button"
                          draggable={false}
                          onDragStart={(ev) => ev.stopPropagation()}
                          onClick={() => {
                            const cur = dashWidgetCols[wid] ?? meta.cols
                            const next = cur >= ERP_DASH_GRID_COLUMNS ? 1 : Number(cur) + 1
                            setDashWidgetCols(prev => ({ ...prev, [wid]: next }))
                          }}
                          title="Resize widget (column span)"
                          style={{ padding: '2px 6px', border: '1px solid #E5E7EB', borderRadius: '5px', background: '#F9FAFB', cursor: 'pointer', fontSize: '0.75rem', color: C.inkSoft, lineHeight: 1 }}
                        >⤢</button>
                        <button
                          type="button"
                          draggable={false}
                          onDragStart={(ev) => ev.stopPropagation()}
                          onClick={() => setDashWidgets(prev => prev.filter(w => w !== wid))}
                          style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px', lineHeight: 1 }}
                        >✕</button>
                      </div>
                    </div>
                    {/* Widget body */}
                    {edgeToEdge
                      ? <div style={{ fontSize: '0.82rem', color: C.inkSoft }}>
                          {renderERP_DashWidget(wid, dashboard, dashChatMessages, (tab) => setActiveTab(tab), onNavigateMain, widgetOptions)}
                        </div>
                      : <div style={{ padding: '12px 13px', fontSize: '0.82rem', color: C.inkSoft }}>
                          {renderERP_DashWidget(wid, dashboard, dashChatMessages, (tab) => setActiveTab(tab), onNavigateMain, widgetOptions)}
                        </div>
                    }
                  </div>
                )
              })}
            </div>
          )}

          {/* Customize modal */}
          {dashCustomizeOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', borderRadius: '0.75rem', width: '560px', maxWidth: '95vw', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: 0, color: C.ink, fontSize: '1rem', fontWeight: '700' }}>Customize Dashboard</h4>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: C.inkSoft }}>{dashPickSelected.length} widget{dashPickSelected.length !== 1 ? 's' : ''} selected</p>
                  </div>
                  <button onClick={() => setDashCustomizeOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: C.inkSoft, cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    {ERP_DASH_ALL_WIDGETS.map(w => {
                      const on = dashPickSelected.includes(w.id)
                      return (
                        <div
                          key={w.id}
                          onClick={() => setDashPickSelected(prev => on ? prev.filter(x => x !== w.id) : [...prev, w.id])}
                          style={{ padding: '0.75rem', borderRadius: '0.5rem', border: `2px solid ${on ? C.s1 : '#E5E7EB'}`, background: on ? '#F0FDF4' : '#FAFAFA', cursor: 'pointer', display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}
                        >
                          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{w.icon}</span>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '600', color: C.ink }}>{w.label}</p>
                            <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: C.inkSoft }}>{w.desc}</p>
                          </div>
                          {on && <span style={{ marginLeft: 'auto', color: C.s1, fontSize: '0.9rem', flexShrink: 0 }}>✓</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button onClick={() => setDashCustomizeOpen(false)} style={{ padding: '0.5rem 1rem', background: C.p2, color: C.inkSoft, border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>Cancel</button>
                  <button
                    onClick={() => {
                      const orderIx = (id) => {
                        const i = ERP_DASH_DEFAULT.indexOf(id)
                        return i === -1 ? 999 : i
                      }
                      const ordered = [...dashPickSelected].sort((a, b) => orderIx(a) - orderIx(b) || String(a).localeCompare(String(b)))
                      setDashWidgets(ensureMarginsThenFixingOrder(ordered))
                      setDashCustomizeOpen(false)
                    }}
                    style={{ padding: '0.5rem 1.25rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ERPDashboardTabContainer>
    </>
  )
}