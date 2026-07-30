import { useState, useMemo, useEffect } from 'react'
import { useLanguage } from '../../../context/LanguageContext'
import { useAuth } from '../../../context/AuthContext'
import projectsAPI from '../../../api/projects'
import AccountCombobox from '../../AccountCombobox'
import {
  MAX_OPS_ASSIGNEES,
  OPS_LINKED_SECTION_OPTS,
  OPS_LINKED_LABEL_KEY,
  projectDocFromApiResponse,
  normalizeOpsProjectForm,
  syncAssignFieldsFromAssignees,
  mapApiTaskToOpsRow,
} from './opsProjectsMapping'
import { OPS_C as C } from './operationsTabTokens'
import {
  B,
  ML,
  MI,
  MS,
  MTA,
  Modal,
  IS,
} from './operationsTabUI'

function ModalProject({
  initial,
  onClose,
  onSave,
  onAddProgress,
  assigneeGroups = [],
  isDepartmentUser,
  allOpsProjects = [],
  token,
  showToast,
  onProjectPatched,
  onArchive,
  onUnarchive,
}) {
  const { t: lt } = useLanguage()
  const { user } = useAuth()
  const [f, setF] = useState(() => normalizeOpsProjectForm(initial))
  const [progressNote, setProgressNote] = useState('')
  const [progressBusy, setProgressBusy] = useState(false)
  const [assignPickerKey, setAssignPickerKey] = useState(0)
  const [alsoNotifyPickerKey, setAlsoNotifyPickerKey] = useState(0)
  const s = k => e => setF((p) => ({ ...p, [k]: e.target.value }))
  const isEdit = !!(initial && initial.id)

  const assigneeIdSet = useMemo(() => new Set((f.assignees || []).map((a) => String(a.id))), [f.assignees])

  useEffect(() => {
    if (isDepartmentUser && !isEdit && user?.id) {
      setF((prev) => {
        if (prev.assignees?.length) return prev
        const self = { id: String(user.id), name: user.name || '' }
        return { ...prev, ...syncAssignFieldsFromAssignees([self]) }
      })
    }
  }, [isDepartmentUser, isEdit, user?.id, user?.name])

  const sortedComments = useMemo(() => {
    const list = [...(f.comments || [])]
    return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [f.comments])

  async function handleAddProgress() {
    const text = progressNote.trim()
    if (!text || !f.id || !onAddProgress) return
    setProgressBusy(true)
    try {
      await onAddProgress(f.id, text)
      setProgressNote('')
    } catch {
      /* parent shows toast */
    } finally {
      setProgressBusy(false)
    }
  }

  return (
    <Modal
      title={isEdit ? lt('opsModalTitleEdit') : lt('opsModalTitleAdd')}
      sub={isEdit ? lt('opsModalSubEdit') : lt('opsModalSubAdd')}
      onClose={onClose}
      onSave={() => f.title.trim() && onSave(f)}
      saveLabel={isEdit ? lt('opsModalSaveChanges') : lt('opsModalSaveAdd')}
    >
      {isEdit && initial?.archivedAt && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(148, 163, 184, 0.12)',
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.45, marginBottom: 8 }}>{lt('opsArchivedProjectBanner')}</div>
          {onUnarchive && (
            <button type="button" onClick={() => onUnarchive({ id: f.id, title: f.title })} style={{ ...B.succ, ...B.sm }}>
              {lt('opsBtnUnarchive')}
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <ML>{lt('opsModalFieldTitle')}</ML>
          <MI value={f.title} onChange={s('title')} placeholder={lt('opsModalPlaceholderShortTitle')} />
        </div>
        <div>
          <ML>{lt('opsModalFieldAssign')}</ML>
          {assigneeGroups.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                {(f.assignees || []).map((a) => (
                  <span
                    key={a.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: 'rgba(var(--purple-rgb),0.1)',
                      border: '1px solid rgba(var(--purple-rgb),0.2)',
                      color: C.t2,
                    }}
                  >
                    {a.name}
                    {!(isDepartmentUser && !isEdit) && (
                      <button
                        type="button"
                        aria-label={lt('opsModalRemove')}
                        onClick={() =>
                          setF((p) => ({
                            ...p,
                            ...syncAssignFieldsFromAssignees((p.assignees || []).filter((x) => String(x.id) !== String(a.id))),
                          }))
                        }
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: 0,
                          marginLeft: 2,
                          fontSize: 12,
                          lineHeight: 1,
                          color: C.t3,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {!(isDepartmentUser && !isEdit) && (f.assignees || []).length < MAX_OPS_ASSIGNEES ? (
                <>
                  <AccountCombobox
                    key={`assign-pick-${assignPickerKey}`}
                    groups={assigneeGroups}
                    value=""
                    placeholder={lt('opsModalAssignAddPlaceholder')}
                    style={{ ...IS, marginBottom: 4 }}
                    onChange={(id, label) => {
                      if (!id) return
                      setF((p) => {
                        const cur = p.assignees || []
                        if (cur.some((x) => String(x.id) === String(id)) || cur.length >= MAX_OPS_ASSIGNEES) return p
                        return { ...p, ...syncAssignFieldsFromAssignees([...cur, { id: String(id), name: label || id }]) }
                      })
                      setAssignPickerKey((k) => k + 1)
                    }}
                  />
                  <div style={{ fontSize: 10, color: C.t4, lineHeight: 1.35 }}>{lt('opsModalMultiPickerHint')}</div>
                </>
              ) : null}
            </div>
          ) : (
            <MI
              value={f.assign}
              onChange={s('assign')}
              placeholder={lt('opsModalAssignManualPlaceholder')}
              disabled={Boolean(isDepartmentUser && !isEdit)}
            />
          )}
        </div>
      </div>
      <ML>{lt('opsModalFieldDescription')}</ML>
      <MTA value={f.desc} onChange={s('desc')} placeholder={lt('opsModalDescPlaceholder')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <ML>{lt('opsModalFieldPriority')}</ML>
          <MS value={f.pri} onChange={s('pri')}>
            {[
              ['Critical', 'opsPriCritical'],
              ['High', 'opsPriHigh'],
              ['Medium', 'opsPriMedium'],
              ['Low', 'opsPriLow'],
            ].map(([val, k]) => (
              <option key={val} value={val}>
                {lt(k)}
              </option>
            ))}
          </MS>
        </div>
        <div>
          <ML>{lt('opsModalFieldStart')}</ML>
          <input type="date" value={f.start} onChange={s('start')} style={IS} />
        </div>
        <div>
          <ML>{lt('opsModalFieldDue')}</ML>
          <input type="date" value={f.due} onChange={s('due')} style={IS} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <ML>{lt('opsModalFieldLinked')}</ML>
          <MS value={f.sec} onChange={s('sec')}>
            {!OPS_LINKED_SECTION_OPTS.includes(f.sec) && f.sec ? <option value={f.sec}>{f.sec}</option> : null}
            {OPS_LINKED_SECTION_OPTS.map((o) => (
              <option key={o} value={o}>
                {lt(OPS_LINKED_LABEL_KEY[o])}
              </option>
            ))}
          </MS>
        </div>
        <div>
          <ML>{lt('opsModalFieldStatus')}</ML>
          <MS value={f.st} onChange={s('st')}>
            {[
              ['To Do', 'opsStatusTodo'],
              ['In Progress', 'opsStatusInProgress'],
              ['Under review', 'opsStatusUnderReview'],
              ['Blocked', 'opsStatusBlocked'],
              ['Done', 'opsStatusDone'],
            ].map(([val, k]) => (
              <option key={val} value={val}>
                {lt(k)}
              </option>
            ))}
          </MS>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <ML>{lt('opsModalFieldReminder')}</ML>
          <input type="datetime-local" value={f.reminderAt || ''} onChange={s('reminderAt')} style={IS} />
        </div>
        <div>
          <ML>{lt('opsModalFieldHours')}</ML>
          <div style={{ display: 'flex', gap: 8 }}>
            <MI
              type="number"
              min="0"
              step="0.25"
              value={f.estimateHours}
              onChange={s('estimateHours')}
              placeholder={lt('opsModalHoursEst')}
              style={{ ...IS, marginBottom: 0 }}
            />
            <MI
              type="number"
              min="0"
              step="0.25"
              value={f.loggedHours}
              onChange={s('loggedHours')}
              placeholder={lt('opsModalHoursLogged')}
              style={{ ...IS, marginBottom: 0 }}
            />
          </div>
        </div>
      </div>
      <ML>{lt('opsModalFieldTags')}</ML>
      <MI
        value={(f.tags || []).join(', ')}
        onChange={(e) => {
          const parts = e.target.value
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 20)
          setF((p) => ({ ...p, tags: parts }))
        }}
        placeholder={lt('opsModalTagsPlaceholder')}
      />
      {f.st === 'Blocked' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <ML>{lt('opsModalBlockedReason')}</ML>
            <MI value={f.blockedReason} onChange={s('blockedReason')} placeholder={lt('opsModalBlockedReasonPh')} />
          </div>
          <div>
            <ML>{lt('opsModalBlockedBy')}</ML>
            <MS value={f.blockedByTaskId || ''} onChange={s('blockedByTaskId')}>
              <option value="">{lt('opsModalNoneDash')}</option>
              {allOpsProjects
                .filter((t) => t.id !== f.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {(t.title || '').slice(0, 60)}
                  </option>
                ))}
            </MS>
          </div>
        </div>
      )}
      <ML>{lt('opsModalChecklistHeading')}</ML>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {(f.checklist || []).map((row, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={Boolean(row.done)}
              onChange={(e) =>
                setF((p) => ({
                  ...p,
                  checklist: (p.checklist || []).map((c, i) => (i === idx ? { ...c, done: e.target.checked } : c)),
                }))
              }
            />
            <MI
              value={row.title}
              onChange={(e) =>
                setF((p) => ({
                  ...p,
                  checklist: (p.checklist || []).map((c, i) => (i === idx ? { ...c, title: e.target.value } : c)),
                }))
              }
              placeholder={lt('opsModalChecklistStepPh')}
              style={{ ...IS, marginBottom: 0, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => setF((p) => ({ ...p, checklist: (p.checklist || []).filter((_c, i) => i !== idx) }))}
              style={{ ...B.ghost, ...B.sm }}
              aria-label={lt('opsModalRemoveChecklistItem')}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setF((p) => ({
              ...p,
              checklist: [...(p.checklist || []), { title: '', done: false, order: (p.checklist || []).length }],
            }))
          }
          style={{ ...B.sec, ...B.sm, alignSelf: 'flex-start' }}
        >
          {lt('opsModalChecklistAdd')}
        </button>
      </div>
      <ML>{lt('opsModalDependsOn')}</ML>
      <select
        multiple
        size={Math.min(6, Math.max(3, (allOpsProjects || []).filter((t) => t.id !== f.id).length))}
        value={f.dependsOn || []}
        onChange={(e) => {
          const values = Array.from(e.target.selectedOptions).map((o) => o.value)
          setF((p) => ({ ...p, dependsOn: values }))
        }}
        style={{ ...IS, minHeight: 72, marginBottom: 12 }}
      >
        {(allOpsProjects || [])
          .filter((t) => t.id !== f.id)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {(t.title || '').slice(0, 80)}
            </option>
          ))}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <ML>{lt('opsModalNotifyMessage')}</ML>
          <MI value={f.notifyText} onChange={s('notifyText')} placeholder={lt('opsModalNotifyPlaceholder')} />
        </div>
        <div>
          <ML>{lt('opsModalAlsoNotify')}</ML>
          {assigneeGroups.length > 0 ? (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                {(f.alsoNotifyIds || []).map((nid, idx) => {
                  const optLabel = (assigneeGroups[0]?.options || []).find((o) => String(o.value) === String(nid))?.label
                  const name = (f.alsoNotifyNames && f.alsoNotifyNames[idx]) || optLabel || String(nid)
                  return (
                    <span
                      key={`${nid}-${idx}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(6, 95, 70, 0.08)',
                        border: '1px solid rgba(6, 95, 70, 0.22)',
                        color: C.t2,
                      }}
                    >
                      {name}
                      <button
                        type="button"
                        aria-label={lt('opsModalRemove')}
                        onClick={() =>
                          setF((p) => {
                            const ids = [...(p.alsoNotifyIds || [])]
                            const names = [...(p.alsoNotifyNames || [])]
                            const i = ids.findIndex((x) => String(x) === String(nid))
                            if (i >= 0) {
                              ids.splice(i, 1)
                              names.splice(i, 1)
                            }
                            return { ...p, alsoNotifyIds: ids, alsoNotifyNames: names }
                          })
                        }
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: 0,
                          marginLeft: 2,
                          fontSize: 12,
                          lineHeight: 1,
                          color: C.t3,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
              <AccountCombobox
                key={`also-pick-${alsoNotifyPickerKey}`}
                groups={[
                  {
                    label: assigneeGroups[0]?.label || 'Team',
                    options: (assigneeGroups[0]?.options || []).filter(
                      (o) => !assigneeIdSet.has(String(o.value)) && !(f.alsoNotifyIds || []).map(String).includes(String(o.value))
                    ),
                  },
                ]}
                value=""
                placeholder={lt('opsModalAlsoNotifyAddPlaceholder')}
                style={{ ...IS, marginBottom: 4 }}
                onChange={(id, label) => {
                  if (!id) return
                  setF((p) => {
                    const ids = [...(p.alsoNotifyIds || [])]
                    const names = [...(p.alsoNotifyNames || [])]
                    if (ids.includes(String(id)) || assigneeIdSet.has(String(id)) || ids.length >= 50) return p
                    ids.push(String(id))
                    names.push(label || id)
                    return { ...p, alsoNotifyIds: ids, alsoNotifyNames: names }
                  })
                  setAlsoNotifyPickerKey((k) => k + 1)
                }}
              />
              <div style={{ fontSize: 10, color: C.t4, lineHeight: 1.35, marginTop: 2 }}>{lt('opsModalMultiPickerHint')}</div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: C.t4, lineHeight: 1.4 }}>{lt('opsModalAlsoNotifyNoTeam')}</div>
          )}
        </div>
      </div>
      {isEdit && f.id && token && (
        <div style={{ marginTop: 10, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <ML>{lt('opsModalAttachments')}</ML>
          <input
            type="file"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const res = await projectsAPI.uploadProjectAttachment(token, f.id, file)
                const doc = projectDocFromApiResponse(res)
                if (doc) {
                  const row = mapApiTaskToOpsRow(doc)
                  setF(normalizeOpsProjectForm(row))
                  onProjectPatched?.(row)
                }
                showToast?.(lt('opsModalUploadedTitle'), file.name)
              } catch {
                showToast?.(lt('error'), lt('opsModalUploadFailed'))
              }
              e.target.value = ''
            }}
            style={{ fontSize: 12, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(f.attachments || []).map((a) => (
              <div key={a.fileName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: C.t2 }}>
                <a href={a.url || `#`} target="_blank" rel="noreferrer" style={{ color: 'var(--purple)' }}>
                  {a.originalName || a.fileName}
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(lt('opsModalRemoveFileConfirm'))) return
                    try {
                      const res = await projectsAPI.deleteProjectAttachment(token, f.id, a.fileName)
                      const doc = projectDocFromApiResponse(res)
                      if (doc) {
                        const row = mapApiTaskToOpsRow(doc)
                        setF(normalizeOpsProjectForm(row))
                        onProjectPatched?.(row)
                      }
                      showToast?.(lt('opsModalRemovedTitle'), a.originalName || '')
                    } catch {
                      showToast?.(lt('error'), lt('opsModalDeleteFailed'))
                    }
                  }}
                  style={{ ...B.ghost, ...B.sm }}
                >
                  {lt('opsModalRemove')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {isEdit && onArchive && !initial?.archivedAt && (
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={() => onArchive(f)} style={{ ...B.warn, ...B.sm }}>
            {lt('opsModalArchive')}
          </button>
        </div>
      )}
      {isEdit && f.id && onAddProgress && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{lt('opsModalProgressHeading')}</div>
          <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedComments.length === 0 && <div style={{ fontSize: 11, color: C.t4 }}>{lt('opsModalNoProgressYet')}</div>}
            {sortedComments.map((c, i) => (
              <div
                key={c._id || `${c.createdAt}-${i}`}
                style={{ fontSize: 11, background: 'rgba(0,0,0,.03)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px' }}
              >
                <div style={{ fontWeight: 700, color: C.t2, marginBottom: 2 }}>{c.author || lt('opsModalDash')}</div>
                <div style={{ fontSize: 10, color: C.t4, marginBottom: 4 }}>{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</div>
                <div style={{ color: C.t3, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{c.text}</div>
              </div>
            ))}
          </div>
          <ML>{lt('opsModalAddProgressLabel')}</ML>
          <MTA value={progressNote} onChange={(e) => setProgressNote(e.target.value)} placeholder={lt('opsModalProgressPlaceholder')} />
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              disabled={progressBusy || !progressNote.trim()}
              onClick={handleAddProgress}
              style={{ ...B.pri, ...B.sm, opacity: progressBusy || !progressNote.trim() ? 0.5 : 1 }}
            >
              {progressBusy ? lt('saving') : lt('opsModalLogProgress')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export { ModalProject }
