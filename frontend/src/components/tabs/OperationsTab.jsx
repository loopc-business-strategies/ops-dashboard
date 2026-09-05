// FILE: src/components/tabs/OperationsTab.jsx
// Operations & Logistics — shell: state/orchestration + lazy panels

import { lazy, Suspense, useState, useMemo, useEffect, useCallback } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { inventoryApi } from '../../api/operations/inventory'
import projectsAPI from '../../api/projects'
import authAPI from '../../api/auth'
import hrAPI from '../../api/hr'
import { ErpSubTabButton, ModuleSubTabRow, ModuleTabColumn } from '../layout/ModuleTabChrome'
import { useDashboardModuleSubTab } from '../../hooks/useDashboardModuleSubTab'
import {
  getOpsTabs,
  INIT_SUPPLIERS,
  INIT_GOLD,
  INIT_ROUTES,
  INIT_SEC_VENDORS,
  INIT_INCIDENTS,
  INIT_VENDORS,
  INIT_INVENTORY,
  INIT_CHECKLIST,
  INIT_NOTIFS,
} from './operations/operationsSeedData'
import { OPS_C as C } from './operations/operationsTabTokens'
import { Toast } from './operations/operationsTabUI'
import {
  OPS_PROJECTS_DEPT,
  mapApiTaskToOpsRow,
  projectDocFromApiResponse,
  buildOpsCreatePayload,
  buildOpsUpdatePayload,
} from './operations/opsProjectsMapping'
import { ModalProject } from './operations/OpsProjectModal'
import {
  ModalSupplier,
  ModalIncident,
  ModalGoldChannel,
  ModalRoute,
  ModalSecVendor,
  ModalVendor,
  ModalInventoryItem,
  ModalChecklistItem,
  NotifPanel,
} from './operations/OpsModals'

const TabKPI = lazy(() => import('./operations/TabKPI'))
const TabChecklist = lazy(() => import('./operations/TabChecklist'))
const TabSupply = lazy(() => import('./operations/TabSupply'))
const TabGold = lazy(() => import('./operations/TabGold'))
const TabRoutes = lazy(() => import('./operations/TabRoutes'))
const TabSecurity = lazy(() => import('./operations/TabSecurity'))
const TabVendors = lazy(() => import('./operations/TabVendors'))
const TabInventory = lazy(() => import('./operations/TabInventory'))
const TabLegalDocuments = lazy(() => import('./operations/LegalDocumentsPanel'))
const TabMap = lazy(() => import('./operations/TabMap'))
const TabAnalytics = lazy(() => import('./operations/TabAnalytics'))
const TabProjects = lazy(() => import('./operations/TabProjects'))

function OpsSubTabFallback() {
  return (
    <div style={{ padding: '1rem', color: '#6B7280', fontSize: '0.875rem' }}>
      Loading…
    </div>
  )
}

export default function OperationsTab() {
  const perms = usePermissions()
  const isAdmin    = perms.isSuperAdmin
  const { t } = useLanguage()
  const { token, user, company } = useAuth()
  const TABS = useMemo(() => getOpsTabs(t), [t])
  const allowedSubIds = useMemo(() => TABS.map((tabItem) => tabItem.id), [TABS])
  const { subTab: activeTab, buildSubHref, handleSubTabClick } = useDashboardModuleSubTab(
    'operations',
    allowedSubIds,
    'kpi',
    company,
  )
  const isHead     = perms.isDepartmentHead
  const isMgmt     = perms.isManagement
  const isUser     = perms.isDepartmentUser
  const isExternal = perms.isExternal
  const canEdit    = isAdmin || isHead
  const USE_SEED_DATA = import.meta.env.DEV && String(import.meta.env.VITE_ENABLE_SEED_DATA || '').toLowerCase() === 'true'

  const [suppliers, setSuppliers] = useState(USE_SEED_DATA ? INIT_SUPPLIERS : [])
  const [gold,      setGold]      = useState(USE_SEED_DATA ? INIT_GOLD : [])
  const [routes,    setRoutes]    = useState(USE_SEED_DATA ? INIT_ROUTES : [])
  const [secVendors,setSecVendors]= useState(USE_SEED_DATA ? INIT_SEC_VENDORS : [])
  const [incidents, setIncidents] = useState(USE_SEED_DATA ? INIT_INCIDENTS : [])
  const [vendors,   setVendors]   = useState(USE_SEED_DATA ? INIT_VENDORS : [])
  const [inventory, setInventory] = useState(USE_SEED_DATA ? INIT_INVENTORY : [])

    const invToRow = item => ({
      id:    item._id || item.id,
      item:  item.name || item.item,
      stock: item.quantity ?? item.stock ?? 0,
      min:   item.minThreshold ?? item.min ?? 0,
      sup:   item.supplierName || item.sup || '—',
      last:  item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : (item.last || '—'),
      st:    item.quantity === 0 || item.stock === 0 ? 'Critical' : (item.quantity || item.stock || 0) <= (item.minThreshold || item.min || 0) ? 'Low Stock' : 'Sufficient',
    })

    const loadInventory = useCallback(async () => {
      try {
        const res = await inventoryApi.getInventory()
        const items = res.items || res.data || []
        if (items.length > 0) setInventory(items.map(invToRow))
      } catch { /* keep current state */ }
    }, [])

    useEffect(() => { loadInventory() }, [loadInventory])
  const [tasks, setTasks] = useState([])
  const [showArchivedOpsProjects, setShowArchivedOpsProjects] = useState(false)
  const [taskAssignees, setTaskAssignees] = useState([])

  const loadOpsProjects = useCallback(async () => {
    if (!token) return []
    try {
      const data = await projectsAPI.getProjects(token)
      const list = data.projects ?? data.tasks ?? []
      const arr = Array.isArray(list) ? list : []
      const ops = arr.filter((t) => String(t.department || '').toLowerCase() === OPS_PROJECTS_DEPT)
      const rows = ops.map(mapApiTaskToOpsRow)
      setTasks(rows)
      return rows
    } catch {
      setTasks([])
      return []
    }
  }, [token])

  useEffect(() => { loadOpsProjects() }, [loadOpsProjects])

  const loadProjectAssignees = useCallback(async () => {
    if (!token) return
    try {
      const isSuperAdmin = user?.role === 'super_admin'
      const [usersRes, employeesRes] = await Promise.allSettled([
        isSuperAdmin ? authAPI.getUsers(token) : Promise.resolve({ users: [] }),
        hrAPI.getEmployees(token),
      ])
      const userList =
        usersRes.status === 'fulfilled' ? (usersRes.value.users || []).map((u) => ({ id: u.id || u._id, name: u.name, department: u.department || '' })) : []
      const employeeList =
        employeesRes.status === 'fulfilled' ? (employeesRes.value.employees || []).map((e) => ({ id: e._id, name: e.name, department: e.department || '' })) : []
      const taskNames = Array.from(new Set(tasks.map((t) => t.assign).filter(Boolean))).map((name) => ({ id: name, name, department: '' }))
      const merged = [...userList, ...employeeList, ...taskNames]
      const uniqueByName = []
      const seen = new Set()
      merged.forEach((p) => {
        const key = (p.name || '').toLowerCase().trim()
        if (!key || seen.has(key)) return
        seen.add(key)
        uniqueByName.push(p)
      })
      setTaskAssignees(uniqueByName)
    } catch {
      setTaskAssignees([])
    }
  }, [token, user?.role, tasks])

  useEffect(() => {
    if (token && activeTab === 'projects') loadProjectAssignees()
  }, [token, activeTab, loadProjectAssignees])

  const assigneeGroups = useMemo(() => {
    if (!taskAssignees.length) return []
    return [{ label: 'Team', options: taskAssignees.map((a) => ({ value: String(a.id), label: a.name })) }]
  }, [taskAssignees])
  const [checklist, setChecklist] = useState(USE_SEED_DATA ? INIT_CHECKLIST : [])
  const [notifs,    setNotifs]    = useState(USE_SEED_DATA ? INIT_NOTIFS : [])
  const [modal,     setModal]     = useState({ type:null, data:null })
  const [notifOpen, setNotifOpen] = useState(false)
  const [toast,     setToast]     = useState(null)

  const closeModal = () => setModal({ type:null, data:null })

  function showToast(title, msg) {
    setToast({ title, msg })
    clearTimeout(showToast._t)
    showToast._t = setTimeout(() => setToast(null), 3200)
  }

  function addSupplier(f) {
    setSuppliers(p => [...p, { id:Date.now(), name:f.name.trim(), cat:f.cat, od:f.od||'—', ed:f.ed||'—', ad:'—', qty:f.qty||'—', qr:'0', pay:'Not Paid', qc:'Pending', st:f.st, notes:f.notes||'—' }])
    closeModal(); showToast('Supplier Added', f.name.trim() + ' added to supply chain')
  }
  function editSupplier(f) {
    setSuppliers(p => p.map(x => x.id===f.id ? { ...x, ...f } : x))
    closeModal(); showToast('Supplier Updated', f.name + ' updated')
  }
  async function createOpsProject(f) {
    try {
      const res = await projectsAPI.createProject(token, buildOpsCreatePayload(f))
      const doc = projectDocFromApiResponse(res)
      if (!doc) {
        await loadOpsProjects()
        closeModal()
        showToast('Project added', `${f.title.trim()} added`)
        return
      }
      const row = mapApiTaskToOpsRow(doc)
      setTasks((p) => [row, ...p])
      closeModal()
      showToast('Project added', `${f.title.trim()} added`)
    } catch {
      showToast('Error', 'Failed to create project')
    }
  }
  async function updateOpsProject(f) {
    try {
      const res = await projectsAPI.updateProject(token, f.id, buildOpsUpdatePayload(f))
      const doc = projectDocFromApiResponse(res)
      if (!doc) {
        await loadOpsProjects()
        closeModal()
        showToast('Project updated', `${f.title} updated`)
        return
      }
      const row = mapApiTaskToOpsRow(doc)
      setTasks((p) => p.map((x) => (x.id === row.id ? row : x)))
      closeModal()
      showToast('Project updated', `${f.title} updated`)
    } catch {
      showToast('Error', 'Failed to update project')
    }
  }

  const canDeleteOpsProject = (row) => {
    const taskApi = row?._api
    if (!taskApi) return false
    if (isAdmin || isHead) return true
    const createdByMe =
      (taskApi.createdById && taskApi.createdById === user?.id) ||
      String(taskApi.createdBy || '').toLowerCase() === String(user?.name || '').toLowerCase()
    return isUser && createdByMe
  }

  async function deleteOpsProject(row) {
    if (!window.confirm(`Delete project "${row.title}"?`)) return
    try {
      await projectsAPI.deleteProject(token, row.id)
      setTasks((p) => p.filter((x) => x.id !== row.id))
      closeModal()
      showToast('Deleted', 'Project removed')
    } catch {
      showToast('Error', 'Failed to delete project')
    }
  }

  async function addOpsProjectProgress(taskId, text) {
    const trimmed = String(text || '').trim()
    if (!trimmed) return
    try {
      const res = await projectsAPI.addProjectComment(token, taskId, trimmed)
      const doc = projectDocFromApiResponse(res)
      if (!doc) {
        const rows = await loadOpsProjects()
        const row = rows.find((r) => String(r.id) === String(taskId))
        if (row) {
          setModal((prev) => (prev.type === 'project-edit' && prev.data?.id === taskId ? { type: 'project-edit', data: row } : prev))
        }
        showToast('Progress logged', 'Update saved')
        return
      }
      const row = mapApiTaskToOpsRow(doc)
      setTasks((p) => p.map((x) => (x.id === row.id ? row : x)))
      setModal((prev) => (prev.type === 'project-edit' && prev.data?.id === taskId ? { type: 'project-edit', data: row } : prev))
      showToast('Progress logged', 'Update saved')
    } catch (e) {
      showToast('Error', 'Failed to add progress update')
      throw e
    }
  }

  function mergeOpsProjectPatched(row) {
    setTasks((p) => p.map((x) => (x.id === row.id ? row : x)))
    setModal((prev) => (prev.type === 'project-edit' && prev.data?.id === row.id ? { type: 'project-edit', data: row } : prev))
  }

  async function unarchiveOpsProjectRow(row) {
    if (!row?.id || !window.confirm(`${t('opsUnarchiveConfirm')} "${row.title}"?`)) return
    try {
      await projectsAPI.updateProject(token, row.id, {
        archivedAt: null,
        notifyText: `${user?.name || 'User'} restored ${row.title} from archive`,
      })
      await loadOpsProjects()
      setModal((prev) => (prev.data?.id === row.id ? { type: null, data: null } : prev))
      showToast(t('opsUnarchiveToastTitle'), row.title)
    } catch {
      showToast('Error', 'Failed to unarchive')
    }
  }

  async function archiveOpsProjectRow(row) {
    if (!row?.id || !window.confirm(`Archive project "${row.title}"?`)) return
    try {
      await projectsAPI.updateProject(token, row.id, {
        archivedAt: new Date().toISOString(),
        notifyText: `${user?.name || 'User'} archived ${row.title}`,
      })
      await loadOpsProjects()
      setModal((prev) => (prev.data?.id === row.id ? { type: null, data: null } : prev))
      showToast('Archived', row.title)
    } catch {
      showToast('Error', 'Failed to archive')
    }
  }
  function addIncident(f) {
    const newInc = { id:`INC-${String(incidents.length+4).padStart(3,'0')}`, date:'Today', route:f.route, vendor:f.vendor, type:f.type, sev:f.sev, st:'Open', res:f.desc||'Under review' }
    setIncidents(p => [newInc, ...p])
    setNotifs(p => [{ id:'INN'+Date.now(), lv:'crit', read:false, title:`🔴 New Incident Reported — ${f.route}`, desc:`${f.type} incident (${f.sev}) reported on ${f.route}. Immediate investigation required.`, time:'Just now' }, ...p])
    closeModal(); showToast('Incident Reported', `${f.type} on ${f.route} — security team notified`)
  }
  function editIncident(f) {
    setIncidents(p => p.map(x => x.id===f.id ? { ...x, ...f } : x))
    closeModal(); showToast('Incident Updated', f.id + ' updated')
  }
  function addGold(f) {
    setGold(p => [...p, { id:Date.now(), code:`GS-${String(p.length+5).padStart(3,'0')}`, name:f.name, vol:Number(f.vol)||0, actual:Number(f.actual)||0, stage:f.stage, cst:f.cst, comp:f.comp, officer:f.officer||'—', region:f.region, risk:f.risk, lastAct:'Today', nextAction:f.nextAction||'—' }])
    closeModal(); showToast('Channel Added', f.name + ' added')
  }
  function editGold(f) {
    setGold(p => p.map(x => x.id===f.id ? { ...x, ...f, vol:Number(f.vol)||0, actual:Number(f.actual)||0 } : x))
    closeModal(); showToast('Channel Updated', f.name + ' updated')
  }
  function addRoute(f) {
    setRoutes(p => [...p, { id:Date.now(), name:f.name, origin:f.origin, dest:f.dest, carrier:f.carrier, mode:f.mode, eta:f.eta, st:f.st, risk:f.risk, lastInc:'None', insurance:'Active', gps:'Active', checkpoints:'0/0', notes:f.notes||'—' }])
    closeModal(); showToast('Route Added', f.name + ' added')
  }
  function editRoute(f) {
    setRoutes(p => p.map(x => x.id===f.id ? { ...x, ...f } : x))
    closeModal(); showToast('Route Updated', f.name + ' updated')
  }
  function addSecVendor(f) {
    setSecVendors(p => [...p, { id:Date.now(), vendor:f.vendor, proto:f.proto, escort:f.escort, lastRev:'Today', nextRev:f.nextRev||'—', incidents:0, threat:f.threat, route:f.route }])
    closeModal(); showToast('Security Vendor Added', f.vendor + ' added')
  }
  function editSecVendor(f) {
    setSecVendors(p => p.map(x => x.id===f.id ? { ...x, ...f } : x))
    closeModal(); showToast('Vendor Updated', f.vendor + ' updated')
  }
  function addVendor(f) {
    setVendors(p => [...p, { id:Date.now(), name:f.name, svc:f.svc, val:f.val||'—', signed:f.signed, exp:f.exp||'—', terms:f.terms||'TBD', mgr:f.mgr||'—', rating:Number(f.rating)||3, renewal:f.renewal, days:null }])
    closeModal(); showToast('Vendor Added', f.name + ' added')
  }
  function editVendor(f) {
    setVendors(p => p.map(x => x.id===f.id ? { ...x, ...f, rating:Number(f.rating)||x.rating } : x))
    closeModal(); showToast('Vendor Updated', f.name + ' updated')
  }
  function addInventoryItem(f) {
    const stock = Number(f.stock)||0, min = Number(f.min)||0
    const payload = { name: f.item, quantity: stock, minThreshold: min, supplierName: f.sup || '', unit: 'units' }
    inventoryApi.createInventoryItem(payload)
      .then(res => { setInventory(p => [...p, invToRow(res.item || res.data || { ...payload, _id: Date.now() })]); closeModal(); showToast('Item Added', f.item + ' added to inventory') })
      .catch(() => showToast('Error', 'Failed to add inventory item'))
  }
  function editInventoryItem(f) {
    const stock = Number(f.stock)||0, min = Number(f.min)||0
    const payload = { name: f.item, quantity: stock, minThreshold: min, supplierName: f.sup || '' }
    inventoryApi.updateInventoryItem(f.id, payload)
      .then(() => { setInventory(p => p.map(x => x.id===f.id ? invToRow({ ...x, ...payload, _id: f.id, updatedAt: new Date().toISOString() }) : x)); closeModal(); showToast('Item Updated', f.item + ' updated') })
      .catch(() => showToast('Error', 'Failed to update inventory item'))
  }
  async function deleteInventoryItem(row) {
    if (!window.confirm(`Delete ${row.item}?`)) return
    try {
      await inventoryApi.deleteInventoryItem(row.id)
      setInventory(p => p.filter(x => x.id !== row.id))
      showToast('Deleted', `${row.item} removed`)
    } catch {
      showToast('Error', 'Failed to delete item')
    }
  }
  function addChecklistItem(f) {
    setChecklist(p => [...p, { item:f.item, assign:f.assign||'—', st:f.st||'In Progress', due:f.due||'—', by:'—', ts:'—' }])
    closeModal(); showToast('Item Added', f.item + ' added to checklist')
  }

  const unreadCount = notifs.filter(n => !n.read).length
  const shared = { suppliers, setSuppliers, gold, setGold, routes, setRoutes, secVendors, setSecVendors, incidents, setIncidents, vendors, setVendors, inventory, setInventory, tasks, setTasks, checklist, setChecklist, canEdit, isAdmin, isHead, isMgmt, isUser, isExternal, showToast, setModal, onDeleteOpsProject: deleteOpsProject, canDeleteOpsProject }

  return (
    <ModuleTabColumn style={{ fontFamily: 'inherit', color: C.t1 }}>
      <style>{`
        @keyframes tabPingOps { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      <ModuleSubTabRow
        right={(
          <button onClick={() => setNotifOpen(true)} style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, background: 'rgba(var(--purple-rgb),.1)', border: '1px solid rgba(var(--purple-rgb),.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 17, flexShrink: 0 }}>
            🔔
            {unreadCount > 0 && <span style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: C.red, color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #f3f4f6' }}>{unreadCount}</span>}
          </button>
        )}
      >
        {TABS.map((t) => (
          <ErpSubTabButton
            key={t.id}
            active={t.id === activeTab}
            href={buildSubHref(t.id)}
            onClick={(event) => handleSubTabClick(t.id, event)}
          >
            {t.label}
          </ErpSubTabButton>
        ))}
      </ModuleSubTabRow>

            {activeTab === 'kpi' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabKPI {...shared} />
        </Suspense>
      )}
      {activeTab === 'checklist' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabChecklist {...shared} />
        </Suspense>
      )}
      {activeTab === 'supply' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabSupply {...shared} onOpenAdd={() => setModal({ type:'supplier-add', data:null })} />
        </Suspense>
      )}
      {activeTab === 'gold' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabGold {...shared} />
        </Suspense>
      )}
      {activeTab === 'routes' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabRoutes {...shared} onOpenIncident={() => setModal({ type:'incident-add', data:null })} />
        </Suspense>
      )}
      {activeTab === 'security' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabSecurity {...shared} onOpenIncident={() => setModal({ type:'incident-add', data:null })} />
        </Suspense>
      )}
      {activeTab === 'vendors' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabVendors {...shared} onOpenAdd={() => setModal({ type:'vendor-add', data:null })} />
        </Suspense>
      )}
      {activeTab === 'inventory' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabInventory {...shared} onDeleteInventory={deleteInventoryItem} />
        </Suspense>
      )}
      {activeTab === 'legal-docs' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabLegalDocuments {...shared} />
        </Suspense>
      )}
      {activeTab === 'map' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabMap {...shared} />
        </Suspense>
      )}
      {activeTab === 'analytics' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabAnalytics {...shared} />
        </Suspense>
      )}
      {activeTab === 'projects' && (
        <Suspense fallback={<OpsSubTabFallback />}>
          <TabProjects
            {...shared}
            showArchived={showArchivedOpsProjects}
            setShowArchived={setShowArchivedOpsProjects}
            onOpenAdd={() => setModal({ type: 'project-add', data: null })}
            onArchiveProject={archiveOpsProjectRow}
            onUnarchiveProject={unarchiveOpsProjectRow}
          />
        </Suspense>
      )}

      {modal.type === 'supplier-add'   && <ModalSupplier      onClose={closeModal} onSave={addSupplier} />}
      {modal.type === 'supplier-edit'  && <ModalSupplier      initial={modal.data} onClose={closeModal} onSave={editSupplier} />}
      {modal.type === 'project-add'       && (
        <ModalProject
          key={`ops-project-add-${modal.data ? JSON.stringify(modal.data) : 'empty'}`}
          initial={modal.data}
          onClose={closeModal}
          onSave={createOpsProject}
          assigneeGroups={assigneeGroups}
          isDepartmentUser={isUser}
          allOpsProjects={tasks}
          token={token}
          showToast={showToast}
        />
      )}
      {modal.type === 'project-edit'      && (
        <ModalProject
          key={`ops-project-edit-${modal.data?.id}-${(modal.data?.comments || []).length}`}
          initial={modal.data}
          onClose={closeModal}
          onSave={updateOpsProject}
          onAddProgress={addOpsProjectProgress}
          assigneeGroups={assigneeGroups}
          isDepartmentUser={isUser}
          allOpsProjects={tasks}
          token={token}
          showToast={showToast}
          onProjectPatched={mergeOpsProjectPatched}
          onArchive={(ff) => archiveOpsProjectRow({ id: ff.id, title: ff.title })}
          onUnarchive={(ff) => unarchiveOpsProjectRow({ id: ff.id, title: ff.title })}
        />
      )}
      {modal.type === 'incident-add'   && <ModalIncident      onClose={closeModal} onSave={addIncident} />}
      {modal.type === 'incident-edit'  && <ModalIncident      initial={modal.data} onClose={closeModal} onSave={editIncident} />}
      {modal.type === 'gold-add'       && <ModalGoldChannel   onClose={closeModal} onSave={addGold} />}
      {modal.type === 'gold-edit'      && <ModalGoldChannel   initial={modal.data} onClose={closeModal} onSave={editGold} />}
      {modal.type === 'route-add'      && <ModalRoute         onClose={closeModal} onSave={addRoute} />}
      {modal.type === 'route-edit'     && <ModalRoute         initial={modal.data} onClose={closeModal} onSave={editRoute} />}
      {modal.type === 'secvendor-add'  && <ModalSecVendor     onClose={closeModal} onSave={addSecVendor} />}
      {modal.type === 'secvendor-edit' && <ModalSecVendor     initial={modal.data} onClose={closeModal} onSave={editSecVendor} />}
      {modal.type === 'vendor-add'     && <ModalVendor        onClose={closeModal} onSave={addVendor} />}
      {modal.type === 'vendor-edit'    && <ModalVendor        initial={modal.data} onClose={closeModal} onSave={editVendor} />}
      {modal.type === 'inventory-add'  && <ModalInventoryItem onClose={closeModal} onSave={addInventoryItem} />}
      {modal.type === 'inventory-edit' && <ModalInventoryItem initial={modal.data} onClose={closeModal} onSave={editInventoryItem} />}
      {modal.type === 'checklist-add'  && <ModalChecklistItem onClose={closeModal} onSave={addChecklistItem} />}

      {notifOpen && <NotifPanel notifs={notifs} setNotifs={setNotifs} onClose={() => setNotifOpen(false)} />}

      <Toast t={toast} />
    </ModuleTabColumn>
  )
}
