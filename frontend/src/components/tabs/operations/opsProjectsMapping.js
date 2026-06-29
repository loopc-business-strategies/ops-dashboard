/** Operations projects API ↔ UI mapping — extracted from OperationsTab.jsx */

export const OPS_PROJECTS_DEPT = 'operations'
export const OPS_PROJECTS_MODULE = 'operations-projects'
/** Match backend MAX_TASK_ASSIGNEES */
export const MAX_OPS_ASSIGNEES = 20
export const OPS_LINKED_SECTION_OPTS = ['Supply Chain', 'Gold Sourcing', 'Transport', 'Security', 'Vendor Contracts', 'Inventory']
export const OPS_LINKED_LABEL_KEY = {
  'Supply Chain': 'opsLinkedSupplyChain',
  'Gold Sourcing': 'opsLinkedGoldSourcing',
  Transport: 'opsLinkedTransport',
  Security: 'opsLinkedSecurity',
  'Vendor Contracts': 'opsLinkedVendorContracts',
  Inventory: 'opsLinkedInventory',
}

/** Align with backend TASK_STALE_MS: prefer VITE_OPS_PROJECTS_STALE_DAYS, else VITE_TASK_STALE_DAYS (1–366). */
const STALE_TASK_DAYS_RAW = Number(
  import.meta.env?.VITE_OPS_PROJECTS_STALE_DAYS ?? import.meta.env?.VITE_TASK_STALE_DAYS,
)
const STALE_TASK_DAYS =
  Number.isFinite(STALE_TASK_DAYS_RAW) && STALE_TASK_DAYS_RAW > 0
    ? Math.min(366, Math.max(1, Math.floor(STALE_TASK_DAYS_RAW)))
    : 7
const STALE_TASK_MS = STALE_TASK_DAYS * 24 * 60 * 60 * 1000

export function dueToInputDate(d) {
  if (!d) return ''
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return ''
  return x.toISOString().slice(0, 10)
}

export function fmtShortDt(dt) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

export function apiStatusToUiSt(s) {
  const key = String(s || '').toLowerCase()
  const m = {
    todo: 'To Do',
    'in-progress': 'In Progress',
    blocked: 'Blocked',
    'under-review': 'Under review',
    done: 'Done',
    cancelled: 'Done',
  }
  return m[key] || 'To Do'
}

export function uiStToApiStatus(st) {
  const m = {
    'To Do': 'todo',
    'In Progress': 'in-progress',
    'Under review': 'under-review',
    Blocked: 'blocked',
    Done: 'done',
  }
  return m[st] || 'todo'
}

export function apiPriToUi(p) {
  const x = String(p || '').toLowerCase()
  if (x === 'critical') return 'Critical'
  if (x === 'high') return 'High'
  if (x === 'medium') return 'Medium'
  return 'Low'
}

export function uiPriToApi(p) {
  if (p === 'Critical') return 'critical'
  if (p === 'High') return 'high'
  if (p === 'Medium') return 'medium'
  return 'low'
}

export function linkedSectionFromApi(t) {
  const lr = (t.linkedRecord || '').trim()
  if (lr) return lr.slice(0, 120)
  return 'Supply Chain'
}

export function isStaleTask(t) {
  if (!t?.updatedAt || String(t.status || '').toLowerCase() === 'done') return false
  try {
    let last = new Date(t.updatedAt).getTime()
    const comments = Array.isArray(t.comments) ? t.comments : []
    for (const c of comments) {
      const ct = c?.createdAt ? new Date(c.createdAt).getTime() : 0
      if (ct > last) last = ct
    }
    return Date.now() - last > STALE_TASK_MS
  } catch {
    return false
  }
}

export function assigneesFromApiTask(t) {
  const ids =
    Array.isArray(t.assignedToIds) && t.assignedToIds.length
      ? [...new Set(t.assignedToIds.map((id) => String(id)))]
      : t.assignedToId
        ? [String(t.assignedToId)]
        : []
  const parts = (t.assignedTo || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.map((id, i) => ({
    id,
    name: parts[i] ?? parts[0] ?? '—',
  }))
}

export function syncAssignFieldsFromAssignees(assignees) {
  const list = Array.isArray(assignees) ? assignees.filter((a) => a && a.id) : []
  return {
    assignees: list,
    assign: list.map((a) => a.name).join(', '),
    assignToId: list[0]?.id || '',
  }
}

export function buildOpsAssigneeApiFields(f) {
  const hex24 = (s) => /^[a-f0-9]{24}$/i.test(String(s))
  if (Array.isArray(f.assignees)) {
    const valid = f.assignees.filter((a) => a && hex24(a.id))
    if (valid.length) {
      const capped = valid.slice(0, MAX_OPS_ASSIGNEES)
      return {
        assignedToIds: capped.map((a) => String(a.id).trim()),
        assignedTo: capped.map((a) => (a.name || '').trim() || 'User').join(', '),
        assignedToId: String(capped[0].id).trim(),
      }
    }
    const manual = (f.assign || '').trim() || (f.assignToId && hex24(f.assignToId))
    if (!manual) {
      return { assignedToIds: [], assignedToId: null, assignedTo: '' }
    }
  }
  return {
    assignedTo: (f.assign || '').trim() || undefined,
    assignedToId: f.assignToId && hex24(f.assignToId) ? String(f.assignToId).trim() : undefined,
  }
}

export function mapApiTaskToOpsRow(t) {
  const d = dueToInputDate(t.dueDate)
  const startD = dueToInputDate(t.startDate)
  const checklist = Array.isArray(t.checklist)
    ? t.checklist.map((c, i) => ({
        title: c.title || '',
        done: Boolean(c.done),
        order: typeof c.order === 'number' ? c.order : i,
      }))
    : []
  const assignees = assigneesFromApiTask(t)
  const assign =
    assignees.length > 0 ? assignees.map((a) => a.name).join(', ') : t.assignedTo || 'Unassigned'
  return {
    id: t._id,
    _api: t,
    title: t.title || '',
    desc: t.description || '',
    assignees,
    assign,
    assignToId: assignees[0]?.id || '',
    pri: apiPriToUi(t.priority),
    due: d || 'TBD',
    start: startD || '',
    st: apiStatusToUiSt(t.status),
    sec: linkedSectionFromApi(t),
    comments: Array.isArray(t.comments) ? [...t.comments] : [],
    reminderAt: t.reminderAt ? new Date(t.reminderAt).toISOString().slice(0, 16) : '',
    archivedAt: t.archivedAt || null,
    autoArchiveAt: t.autoArchiveAt || null,
    createdBy: t.createdBy || '',
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    alsoNotifyIds: (t.alsoNotifyIds || []).map((id) => String(id)),
    alsoNotifyNames: Array.isArray(t.alsoNotifyNames) ? [...t.alsoNotifyNames] : [],
    tags: Array.isArray(t.tags) ? [...t.tags] : [],
    checklist,
    blockedReason: t.blockedReason || '',
    blockedByTaskId: t.blockedByTaskId ? String(t.blockedByTaskId) : '',
    dependsOn: (t.dependsOn || []).map((x) => String(x)),
    estimateHours: t.estimateHours != null && !Number.isNaN(Number(t.estimateHours)) ? String(t.estimateHours) : '',
    loggedHours: t.loggedHours != null && !Number.isNaN(Number(t.loggedHours)) ? String(t.loggedHours) : '',
    attachments: Array.isArray(t.attachments) ? [...t.attachments] : [],
    stale: isStaleTask(t),
    notifyText: '',
  }
}

/** Prefer `project` / `projects`; tolerate older API bodies that used `task` / `tasks`. */
export function projectDocFromApiResponse(res) {
  return res?.project ?? res?.task ?? null
}

export function buildOpsExtendedPayload(f) {
  const tags = Array.isArray(f.tags) ? [...new Set(f.tags.map((x) => String(x).trim()).filter(Boolean))].slice(0, 20).map((x) => x.slice(0, 40)) : []
  const checklist = Array.isArray(f.checklist)
    ? f.checklist
        .filter((c) => c && String(c.title || '').trim())
        .slice(0, 40)
        .map((c, i) => ({
          title: String(c.title).trim().slice(0, 200),
          done: Boolean(c.done),
          order: typeof c.order === 'number' && !Number.isNaN(c.order) ? c.order : i,
        }))
    : []
  const blockedReason = f.st === 'Blocked' ? String(f.blockedReason || '').trim().slice(0, 500) : ''
  const blockedByTaskId = f.st === 'Blocked' && f.blockedByTaskId ? String(f.blockedByTaskId).trim() : ''
  const dependsOn = Array.isArray(f.dependsOn) ? [...new Set(f.dependsOn.filter(Boolean).map(String))] : []
  const eh = f.estimateHours === '' || f.estimateHours == null ? null : Number(f.estimateHours)
  const lh = f.loggedHours === '' || f.loggedHours == null ? null : Number(f.loggedHours)
  return {
    tags,
    checklist,
    blockedReason,
    blockedByTaskId: blockedByTaskId || undefined,
    dependsOn: dependsOn.length ? dependsOn : [],
    estimateHours: eh != null && !Number.isNaN(eh) ? eh : null,
    loggedHours: lh != null && !Number.isNaN(lh) ? lh : null,
  }
}

export function buildOpsCreatePayload(f) {
  const ext = buildOpsExtendedPayload(f)
  const hex24 = (s) => /^[a-f0-9]{24}$/i.test(String(s))
  const alsoNotifyIds = Array.isArray(f.alsoNotifyIds) ? [...new Set(f.alsoNotifyIds.filter(hex24))].slice(0, 50) : []
  const alsoNotifyNames = Array.isArray(f.alsoNotifyNames)
    ? [...new Set(f.alsoNotifyNames.map((x) => String(x).trim()).filter(Boolean))].slice(0, 50)
    : []
  const assignPart = buildOpsAssigneeApiFields(f)
  return {
    title: f.title.trim(),
    description: (f.desc || '').trim(),
    ...assignPart,
    department: OPS_PROJECTS_DEPT,
    linkedRecord: String(f.sec || '').trim().slice(0, 120),
    module: OPS_PROJECTS_MODULE,
    status: uiStToApiStatus(f.st),
    priority: uiPriToApi(f.pri),
    dueDate: f.due && f.due !== 'TBD' ? f.due : undefined,
    startDate: f.start && String(f.start).trim() ? f.start : null,
    reminderAt: f.reminderAt ? new Date(f.reminderAt).toISOString() : undefined,
    notifyText: (f.notifyText || '').trim() || undefined,
    alsoNotifyIds: alsoNotifyIds.length ? alsoNotifyIds : undefined,
    alsoNotifyNames: alsoNotifyNames.length ? alsoNotifyNames : undefined,
    ...ext,
  }
}

export function buildOpsUpdatePayload(f) {
  const ext = buildOpsExtendedPayload(f)
  const hex24 = (s) => /^[a-f0-9]{24}$/i.test(String(s))
  const alsoNotifyIds = Array.isArray(f.alsoNotifyIds) ? [...new Set(f.alsoNotifyIds.filter(hex24))].slice(0, 50) : []
  const alsoNotifyNames = Array.isArray(f.alsoNotifyNames)
    ? [...new Set(f.alsoNotifyNames.map((x) => String(x).trim()).filter(Boolean))].slice(0, 50)
    : []
  const assignPart = buildOpsAssigneeApiFields(f)
  return {
    title: f.title.trim(),
    description: (f.desc || '').trim(),
    ...assignPart,
    linkedRecord: String(f.sec || '').trim().slice(0, 120),
    module: OPS_PROJECTS_MODULE,
    status: uiStToApiStatus(f.st),
    priority: uiPriToApi(f.pri),
    dueDate: f.due && f.due !== 'TBD' ? f.due : undefined,
    startDate: f.start && String(f.start).trim() ? f.start : null,
    reminderAt: f.reminderAt ? new Date(f.reminderAt).toISOString() : undefined,
    notifyText: (f.notifyText || '').trim() || undefined,
    alsoNotifyIds: alsoNotifyIds.length ? alsoNotifyIds : undefined,
    alsoNotifyNames: alsoNotifyNames.length ? alsoNotifyNames : undefined,
    ...ext,
  }
}

export function defaultOpsProjectForm() {
  return {
    title: '',
    desc: '',
    assignees: [],
    assign: '',
    assignToId: '',
    pri: 'High',
    due: '',
    start: '',
    sec: 'Supply Chain',
    st: 'To Do',
    comments: [],
    reminderAt: '',
    notifyText: '',
    alsoNotifyIds: [],
    alsoNotifyNames: [],
    tags: [],
    checklist: [],
    blockedReason: '',
    blockedByTaskId: '',
    dependsOn: [],
    estimateHours: '',
    loggedHours: '',
    attachments: [],
  }
}

export function normalizeOpsProjectForm(initial) {
  const base = defaultOpsProjectForm()
  if (!initial) return base
  const assigneesFromInitial =
    Array.isArray(initial.assignees) && initial.assignees.length
      ? initial.assignees.map((a) => ({ id: String(a.id), name: String(a.name || '').trim() || '—' }))
      : initial.assignToId
        ? [{ id: String(initial.assignToId), name: (initial.assign || '').split(',')[0].trim() || '—' }]
        : []
  const assignSync = syncAssignFieldsFromAssignees(assigneesFromInitial)
  if (!initial.id) {
    return {
      ...base,
      ...initial,
      ...assignSync,
      comments: Array.isArray(initial.comments) ? initial.comments : [],
      tags: Array.isArray(initial.tags) ? initial.tags : [],
      checklist: Array.isArray(initial.checklist) ? initial.checklist : [],
      dependsOn: Array.isArray(initial.dependsOn) ? initial.dependsOn : [],
      alsoNotifyIds: Array.isArray(initial.alsoNotifyIds) ? initial.alsoNotifyIds.map(String) : [],
      alsoNotifyNames: Array.isArray(initial.alsoNotifyNames) ? [...initial.alsoNotifyNames] : [],
      attachments: Array.isArray(initial.attachments) ? initial.attachments : [],
    }
  }
  return {
    id: initial.id,
    title: initial.title || '',
    desc: initial.desc || '',
    ...assignSync,
    pri: initial.pri || 'High',
    due: initial.due && initial.due !== 'TBD' ? initial.due : '',
    start: initial.start && initial.start !== 'TBD' ? initial.start : '',
    sec: initial.sec || 'Supply Chain',
    st: initial.st || 'To Do',
    comments: Array.isArray(initial.comments) ? initial.comments : [],
    reminderAt: initial.reminderAt || '',
    notifyText: initial.notifyText || '',
    alsoNotifyIds: Array.isArray(initial.alsoNotifyIds) ? initial.alsoNotifyIds.map(String) : [],
    alsoNotifyNames: Array.isArray(initial.alsoNotifyNames) ? [...initial.alsoNotifyNames] : [],
    tags: Array.isArray(initial.tags) ? initial.tags : [],
    checklist: Array.isArray(initial.checklist) ? initial.checklist : [],
    blockedReason: initial.blockedReason || '',
    blockedByTaskId: initial.blockedByTaskId || '',
    dependsOn: Array.isArray(initial.dependsOn) ? initial.dependsOn : [],
    estimateHours: initial.estimateHours != null ? String(initial.estimateHours) : '',
    loggedHours: initial.loggedHours != null ? String(initial.loggedHours) : '',
    attachments: Array.isArray(initial.attachments) ? initial.attachments : [],
  }
}
