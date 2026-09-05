import { useMemo } from 'react'
import { useLanguage } from '../../../context/LanguageContext'
import { OPS_C as C } from './operationsTabTokens'
import { B, Badge, TableWrap, TableHead, SH, Restrict, TH, TD } from './operationsTabUI'
import { fmtShortDt } from './opsProjectsMapping'

export default function TabProjects({
  tasks,
  showArchived,
  setShowArchived,
  canEdit,
  isExternal,
  onOpenAdd,
  setModal,
  onDeleteOpsProject,
  canDeleteOpsProject,
  onArchiveProject,
  onUnarchiveProject,
}) {
  const { t: tr } = useLanguage()
  const visible = useMemo(() => tasks.filter((t) => showArchived || !t.archivedAt), [tasks, showArchived])
  const openCount = useMemo(() => visible.filter((t) => t.st !== 'Done').length, [visible])
  const doneCount = useMemo(() => visible.filter((t) => t.st === 'Done').length, [visible])
  if (isExternal) return <Restrict text={tr('opsProjectsRestrictExternal')} />

  const cols = [
    { key: 'To Do', labelKey: 'opsColTodo', color: C.t3 },
    { key: 'In Progress', labelKey: 'opsColInProgress', color: C.yellow },
    { key: 'Under review', labelKey: 'opsColUnderReview', color: C.pur },
    { key: 'Blocked', labelKey: 'opsColBlocked', color: C.red },
    { key: 'Done', labelKey: 'opsColDone', color: C.green },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SH
        title={tr('opsProjectsTitle')}
        sub={`${openCount} ${tr('opsProjectsOpen')} · ${doneCount} ${tr('opsProjectsCompleted')}${showArchived ? ` ${tr('opsProjectsIncArchived')}` : ''}`}
      >
        {canEdit && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: C.t3, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              {tr('opsShowArchived')}
            </label>
            <button type="button" style={B.pri} onClick={onOpenAdd}>
              {tr('opsAddProject')}
            </button>
          </div>
        )}
      </SH>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {cols.map((col) => {
          const items = visible.filter((t) => t.st === col.key)
          return (
            <div
              key={col.key}
              style={{
                minWidth: 200,
                width: 200,
                background: C.card2,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: col.color }} />
              <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>{tr(col.labelKey)}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: col.color, marginTop: 3 }}>
                  {items.length} {items.length === 1 ? tr('opsProjectsCountOne') : tr('opsProjectsCountMany')}
                </div>
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {items.map((t) => {
                  const priC = t.pri === 'Critical' || t.pri === 'High' ? C.red : t.pri === 'Medium' ? C.yellow : C.cyan
                  const nProg = (t.comments || []).length
                  const descPreview = (t.desc || '').trim()
                  const cl = t.checklist || []
                  const chkPct = cl.length ? Math.round((100 * cl.filter((c) => c.done).length) / cl.length) : null
                  return (
                    <div
                      key={t.id}
                      onClick={() => canEdit && setModal({ type: 'project-edit', data: t })}
                      style={{
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: '11px 12px',
                        cursor: canEdit ? 'pointer' : 'default',
                        opacity: t.archivedAt ? 0.65 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, flex: 1 }}>{t.title}</div>
                        {t.stale && (
                          <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 4, background: 'rgba(255,214,0,.2)', color: '#92400e', flexShrink: 0 }}>{tr('opsStaleBadge')}</span>
                        )}
                      </div>
                      {descPreview && (
                        <div
                          style={{
                            fontSize: 10,
                            color: C.t3,
                            lineHeight: 1.35,
                            marginBottom: 6,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {descPreview}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: C.t4, marginBottom: 4 }}>
                        {t.createdBy ? `${tr('opsProjectsMetaBy')} ${t.createdBy}` : ''}
                        {t.updatedAt ? ` · ${tr('opsProjectsMetaUpd')} ${fmtShortDt(t.updatedAt)}` : ''}
                      </div>
                      {chkPct != null && (
                        <div style={{ fontSize: 10, color: C.t3, marginBottom: 4 }}>
                          {tr('opsProjectsChecklistPct')}: {chkPct}%
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: C.t3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span>{t.sec}</span>
                        {nProg > 0 && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 20,
                              background: 'rgba(0,180,216,.12)',
                              color: C.cyan,
                              border: '1px solid rgba(0,180,216,.25)',
                              flexShrink: 0,
                            }}
                          >
                            {nProg}{' '}
                            {nProg === 1 ? tr('opsProjectsUpdateSingular') : tr('opsProjectsUpdatePlural')}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${priC}15`, color: priC, border: `1px solid ${priC}30` }}>{t.pri}</span>
                        <div style={{ fontSize: 10, color: C.t4 }}>👤 {t.assign}</div>
                      </div>
                      <div style={{ fontSize: 10, color: C.t4, marginTop: 5 }}>
                        {tr('opsProjectsStartLabel')}{' '}
                        {t.start || tr('opsModalDash')}
                      </div>
                      <div style={{ fontSize: 10, color: C.t4, marginTop: 3 }}>
                        {tr('opsProjectsDueLabel')} {t.due}
                      </div>
                      {t.reminderAt && <div style={{ fontSize: 9, color: C.pur, marginTop: 3 }}>⏰ {tr('opsProjectsReminderSet')}</div>}
                      {t.autoArchiveAt && !t.archivedAt && (
                        <div style={{ fontSize: 9, color: C.t3, marginTop: 3 }}>
                          📦 {tr('opsAutoArchiveHint')} {fmtShortDt(t.autoArchiveAt)}
                        </div>
                      )}
                    </div>
                  )
                })}
                {!items.length && (
                  <div style={{ fontSize: 11, color: C.t4, textAlign: 'center', padding: '16px 0' }}>{tr('opsNoProjectsInColumn')}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <TableWrap>
        <TableHead title={tr('opsProjectsListViewTitle')} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1020 }}>
            <thead>
              <tr>
                {[
                  tr('opsThProject'),
                  tr('opsThAssigned'),
                  tr('opsThPriority'),
                  tr('opsThDue'),
                  tr('opsThStart'),
                  tr('opsThStatus'),
                  tr('opsThSection'),
                  tr('opsThMeta'),
                  ...(canEdit ? [tr('opsThActions')] : []),
                ].map((h, i) => (
                  <th key={i} style={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const rowBg = t.st === 'Blocked' ? 'rgba(255,71,87,.04)' : t.st === 'Done' ? 'rgba(0,200,150,.03)' : ''
                return (
                  <tr key={t.id} style={{ background: rowBg }}>
                    <td style={{ ...TD, fontWeight: 700, color: C.t1 }}>
                      {t.title}
                      {t.stale && (
                        <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: '#92400e' }}> {tr('opsStaleBadge')}</span>
                      )}
                    </td>
                    <td style={{ ...TD, color: C.t2 }}>{t.assign}</td>
                    <td style={TD}>
                      <Badge s={t.pri} />
                    </td>
                    <td style={{ ...TD, color: C.t3 }}>{t.due}</td>
                    <td style={{ ...TD, color: C.t3 }}>{t.start || tr('opsModalDash')}</td>
                    <td style={TD}>
                      <Badge s={t.st} />
                    </td>
                    <td style={TD}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(0,180,216,.12)', color: C.cyan, border: '1px solid rgba(0,180,216,.3)' }}>{t.sec}</span>
                    </td>
                    <td style={{ ...TD, fontSize: 10, color: C.t4 }}>
                      {t.createdBy ? `${t.createdBy} · ` : ''}
                      {t.updatedAt ? fmtShortDt(t.updatedAt) : tr('opsModalDash')}
                      {t.archivedAt ? ` · ${tr('opsArchived')}` : ''}
                    </td>
                    {canEdit && (
                      <td style={TD}>
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'project-edit', data: t })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', marginRight: 8 }}
                        >
                          {tr('edit')}
                        </button>
                        {!t.archivedAt && onArchiveProject && (
                          <button
                            type="button"
                            onClick={() => onArchiveProject(t)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', marginRight: 8 }}
                          >
                            {tr('opsBtnArchive')}
                          </button>
                        )}
                        {t.archivedAt && onUnarchiveProject && (
                          <button
                            type="button"
                            onClick={() => onUnarchiveProject(t)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', marginRight: 8 }}
                          >
                            {tr('opsBtnUnarchive')}
                          </button>
                        )}
                        {canDeleteOpsProject(t) && (
                          <button type="button" onClick={() => onDeleteOpsProject(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                            {tr('opsBtnDel')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}

// ─── Modals ──────────────────────────────────────────────────────────────────────
