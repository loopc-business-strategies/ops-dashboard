// FILE: src/components/tabs/TrainingTab.jsx
// Training & Development — shell: state/orchestration + lazy panels

import { lazy, Suspense, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../context/LanguageContext'
import trainingAPI from '../../api/training'
import { useDashboardModuleSubTab } from '../../hooks/useDashboardModuleSubTab'
import { ErpSubTabButton, ModuleSubTabRow, ModuleTabColumn } from '../layout/ModuleTabChrome'
import {
  getTrainingTabs,
  INIT_SESSIONS,
  INIT_BATCHES,
  INIT_ATTENDANCE,
  INIT_RESOURCES,
  INIT_ASSESSMENTS,
  INIT_CERTS,
  INIT_FEEDBACK,
  INIT_TRAINEES,
  INIT_NOTIFS,
} from './training/trainingSeedData'
import { C, Toast } from './training/ui'
import {
  ModalSession,
  ModalBatch,
  ModalAttendance,
  ModalAssessment,
  ModalResource,
  ModalCert,
  ModalTrainee,
  ModalFeedback,
  ModalProfile,
  ModalSessionDetail,
  NotifPanel,
} from './training/TrainingModals'

const TabKPI = lazy(() => import('./training/TabKPI'))
const TabCalendar = lazy(() => import('./training/TabCalendar'))
const TabBatches = lazy(() => import('./training/TabBatches'))
const TabAttendance = lazy(() => import('./training/TabAttendance'))
const TabResources = lazy(() => import('./training/TabResources'))
const TabAssessments = lazy(() => import('./training/TabAssessments'))
const TabCerts = lazy(() => import('./training/TabCerts'))
const TabFeedback = lazy(() => import('./training/TabFeedback'))
const TabAnalytics = lazy(() => import('./training/TabAnalytics'))
const TabTrainees = lazy(() => import('./training/TabTrainees'))
const TabSkillGap = lazy(() => import('./training/TabSkillGap'))

function TrainingSubTabFallback() {
  return (
    <div style={{ padding: '1rem', color: '#6B7280', fontSize: '0.875rem' }}>
      Loading…
    </div>
  )
}

export default function TrainingTab() {
  const { token, company } = useAuth()
  const perms    = usePermissions()
  const isAdmin  = perms.isSuperAdmin
  const { t } = useLanguage()
  const TABS = useMemo(() => getTrainingTabs(t), [t])
  const allowedSubIds = useMemo(() => TABS.map((tabItem) => tabItem.id), [TABS])
  const { subTab: activeTab, buildSubHref, handleSubTabClick } = useDashboardModuleSubTab(
    'training',
    allowedSubIds,
    'kpi',
    company,
  )
  const isHead   = perms.isDepartmentHead   // Training Head
  const isMgmt   = perms.isManagement
  const isUser   = perms.isDepartmentUser   // Trainer or HR Manager
  const isExternal = perms.isExternal       // Trainee
  const canEdit  = isAdmin || isHead || isUser
  const canApprove = isAdmin || isHead

  // For display purposes: trainers see trainer view, trainees see self-only view
  const isTrainee = isExternal
  const isTrainer = isUser && !isMgmt
  const USE_SEED_DATA = import.meta.env.DEV && String(import.meta.env.VITE_ENABLE_SEED_DATA || '').toLowerCase() === 'true'

  const [sessions,    setSessions]    = useState(USE_SEED_DATA ? INIT_SESSIONS : [])
  const [batches,     setBatches]     = useState(USE_SEED_DATA ? INIT_BATCHES : [])
  const [attendance,  setAttendance]  = useState(USE_SEED_DATA ? INIT_ATTENDANCE : [])
  const [resources,   setResources]   = useState(USE_SEED_DATA ? INIT_RESOURCES : [])
  const [assessments, setAssessments] = useState(USE_SEED_DATA ? INIT_ASSESSMENTS : [])
  const [certs,       setCerts]       = useState(USE_SEED_DATA ? INIT_CERTS : [])
  const [feedback,    setFeedback]    = useState(USE_SEED_DATA ? INIT_FEEDBACK : [])
  const [trainees,    setTrainees]    = useState(USE_SEED_DATA ? INIT_TRAINEES : [])
  const [notifs,      setNotifs]      = useState(USE_SEED_DATA ? INIT_NOTIFS : [])

  const [modal,     setModal]     = useState({ type:null, data:null })
  const [sessDet,   setSessDet]   = useState(null)
  const [profName,  setProfName]  = useState(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [toast,     setToast]     = useState(null)
  const toastTimerRef = useRef(null)
  const showToast = useCallback((title, msg) => {
    setToast({ title, msg })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 3000)
  }, [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const norm = rows => rows.map(r => ({ ...r, id: r._id?.toString() || r.id }))
    Promise.all([
      trainingAPI.sessions.list(),
      trainingAPI.batches.list(),
      trainingAPI.attendance.list(),
      trainingAPI.resources.list(),
      trainingAPI.assessments.list(),
      trainingAPI.certs.list(),
      trainingAPI.feedback.list(),
      trainingAPI.trainees.list(),
    ]).then(([s, b, a, res, ass, c, fb, tr]) => {
      if (cancelled) return
      if (s.length)   setSessions(norm(s))
      if (b.length)   setBatches(norm(b))
      if (a.length)   setAttendance(norm(a))
      if (res.length) setResources(norm(res))
      if (ass.length) setAssessments(norm(ass))
      if (c.length)   setCerts(norm(c))
      if (fb.length)  setFeedback(norm(fb))
      if (tr.length)  setTrainees(norm(tr))
    }).catch(() => { showToast('Error', 'Failed to load training data. Showing available records.') })
    return () => { cancelled = true }
  }, [token, showToast])

  function closeModal() { setModal({ type:null, data:null }) }

  function saveSession(f) {
    const payload = {
      title: f.title.trim(),
      prog: f.prog,
      date: f.date || 'Apr 30',
      day: f.day || parseInt((f.date || '').split('-')[2], 10) || 30,
      time: f.time || '09:00',
      trainer: f.trainer || 'TBD',
      batch: f.batch,
      venue: f.venue,
      st: f.st,
    }
    if (f.id) {
      trainingAPI.sessions.update(f.id, payload).then(doc => {
        setSessions(p => p.map(x => x.id === f.id ? { ...doc, id: doc._id?.toString() || f.id } : x))
      }).catch(() => setSessions(p => p.map(x => x.id === f.id ? { ...x, ...payload } : x)))
    } else {
      trainingAPI.sessions.create(payload).then(doc => {
        setSessions(p => [...p, { ...doc, id: doc._id?.toString() || Date.now() }])
      }).catch(() => setSessions(p => [...p, { ...payload, id: Date.now() }]))
    }
    closeModal()
    showToast(f.id ? 'Session Updated' : 'Session Added', payload.title)
  }
  function saveBatch(f) {
    const payload = {
      name: f.name.trim(),
      prog: f.prog,
      start: f.start || 'TBD',
      end: f.end || 'TBD',
      trainer: f.trainer || 'TBD',
      trainees: Number(f.trainees) || 0,
      st: f.st,
      completion: Number(f.completion) || 0,
    }
    if (f.id) {
      trainingAPI.batches.update(f.id, payload).then(doc => {
        setBatches(p => p.map(x => x.id === f.id ? { ...doc, id: doc._id?.toString() || f.id } : x))
      }).catch(() => setBatches(p => p.map(x => x.id === f.id ? { ...x, ...payload } : x)))
    } else {
      trainingAPI.batches.create(payload).then(doc => {
        setBatches(p => [...p, { ...doc, id: doc._id?.toString() || Date.now() }])
      }).catch(() => setBatches(p => [...p, { ...payload, id: Date.now() }]))
    }
    closeModal()
    showToast(f.id ? 'Batch Updated' : 'Batch Created', payload.name)
  }
  function saveResource(f) {
    const payload = {
      name: f.name.trim(),
      prog: f.prog,
      type: f.type,
      by: f.by || 'You',
      date: f.date || 'Today',
      views: Number(f.views) || 0,
    }
    if (f.id) {
      trainingAPI.resources.update(f.id, payload).then(doc => {
        setResources(p => p.map(x => x.id === f.id ? { ...doc, id: doc._id?.toString() || f.id } : x))
      }).catch(() => setResources(p => p.map(x => x.id === f.id ? { ...x, ...payload } : x)))
    } else {
      trainingAPI.resources.create(payload).then(doc => {
        setResources(p => [...p, { ...doc, id: doc._id?.toString() || Date.now() }])
      }).catch(() => setResources(p => [...p, { ...payload, id: Date.now() }]))
    }
    closeModal()
    showToast(f.id ? 'Resource Updated' : 'Resource Added', payload.name)
  }
  function saveAssessment(f) {
    const score = parseInt(f.score) || 0
    const pass  = score >= 75
    const payload = {
      trainee: f.trainee,
      prog: f.prog,
      score,
      pass,
      date: f.date || 'Apr 13, 2026',
      attempt: parseInt(f.attempt, 10) || 1,
    }
    if (f.id) {
      trainingAPI.assessments.update(f.id, payload).then(doc => {
        setAssessments(p => p.map(x => x.id === f.id ? { ...doc, id: doc._id?.toString() || f.id } : x))
      }).catch(() => setAssessments(p => p.map(x => x.id === f.id ? { ...x, ...payload } : x)))
    } else {
      trainingAPI.assessments.create(payload).then(doc => {
        setAssessments(p => [...p, { ...doc, id: doc._id?.toString() || Date.now() }])
      }).catch(() => setAssessments(p => [...p, { ...payload, id: Date.now() }]))
    }
    closeModal()
    showToast('Assessment Saved', `Score: ${score}% — ${pass ? 'PASS' : 'FAIL'}`)
  }
  function saveCert(f) {
    const payload = {
      trainee: f.trainee,
      cert: f.cert,
      issued: f.issued || '—',
      expiry: f.expiry || '—',
      st: f.st,
      doc: f.doc || '—',
    }
    if (f.id) {
      trainingAPI.certs.update(f.id, payload).then(doc => {
        setCerts(p => p.map(x => x.id === f.id ? { ...doc, id: doc._id?.toString() || f.id } : x))
      }).catch(() => setCerts(p => p.map(x => x.id === f.id ? { ...x, ...payload } : x)))
    } else {
      trainingAPI.certs.create(payload).then(doc => {
        setCerts(p => [...p, { ...doc, id: doc._id?.toString() || Date.now() }])
      }).catch(() => setCerts(p => [...p, { ...payload, id: Date.now() }]))
    }
    closeModal()
    showToast(f.id ? 'Certificate Updated' : 'Certificate Added', payload.cert)
  }
  function saveTrainee(f) {
    const payload = {
      name: f.name,
      dept: f.dept,
      role: f.role,
      email: f.email,
      prog: Array.isArray(f.prog) ? f.prog : String(f.prog || '').split(',').map(x => x.trim()).filter(Boolean),
      att: Number(f.att) || 0,
      certs: Number(f.certs) || 0,
    }
    if (f.id) {
      trainingAPI.trainees.update(f.id, payload).then(doc => {
        setTrainees(p => p.map(x => x.id === f.id ? { ...doc, id: doc._id?.toString() || f.id } : x))
      }).catch(() => setTrainees(p => p.map(x => x.id === f.id || x.name === f.name ? { ...x, ...payload } : x)))
    } else {
      trainingAPI.trainees.create(payload).then(doc => {
        setTrainees(p => [...p, { ...doc, id: doc._id?.toString() || Date.now() }])
      }).catch(() => setTrainees(p => [...p, { ...payload, id: Date.now() }]))
    }
    closeModal()
    showToast(f.id ? 'Trainee Updated' : 'Trainee Enrolled', payload.name)
  }
  function addFeedback(f) {
    const payload = { trainer:'James O.', trainee:'You', session:'Equipment Operation', trainerRating:f.trainerRating, contentRating:f.contentRating, venueRating:f.venueRating, comment:f.comment }
    trainingAPI.feedback.create(payload).then(doc => {
      setFeedback(p => [...p, { ...doc, id: doc._id?.toString() || Date.now() }])
    }).catch(() => setFeedback(p => [...p, { ...payload, id: Date.now() }]))
    closeModal()
    showToast('Feedback Submitted', 'Thank you for your feedback!')
  }

  function deleteSession(id) {
    const prev = sessions
    setSessions(p => p.filter(x => x.id !== id))
    trainingAPI.sessions.remove(id)
      .then(() => showToast('Session Deleted', 'Session removed successfully.'))
      .catch(() => {
        setSessions(prev)
        showToast('Error', 'Failed to delete session. Please try again.')
      })
  }
  function deleteBatch(id) {
    const prev = batches
    setBatches(p => p.filter(x => x.id !== id))
    trainingAPI.batches.remove(id)
      .then(() => showToast('Batch Deleted', 'Batch removed successfully.'))
      .catch(() => {
        setBatches(prev)
        showToast('Error', 'Failed to delete batch. Please try again.')
      })
  }
  function deleteResource(id) {
    const prev = resources
    setResources(p => p.filter(x => x.id !== id))
    trainingAPI.resources.remove(id)
      .then(() => showToast('Resource Deleted', 'Resource removed successfully.'))
      .catch(() => {
        setResources(prev)
        showToast('Error', 'Failed to delete resource. Please try again.')
      })
  }
  function deleteAssessment(id) {
    const prev = assessments
    setAssessments(p => p.filter(x => x.id !== id))
    trainingAPI.assessments.remove(id)
      .then(() => showToast('Assessment Deleted', 'Assessment removed successfully.'))
      .catch(() => {
        setAssessments(prev)
        showToast('Error', 'Failed to delete assessment. Please try again.')
      })
  }
  function deleteCert(id) {
    const prev = certs
    setCerts(p => p.filter(x => x.id !== id))
    trainingAPI.certs.remove(id)
      .then(() => showToast('Certificate Deleted', 'Certificate removed successfully.'))
      .catch(() => {
        setCerts(prev)
        showToast('Error', 'Failed to delete certificate. Please try again.')
      })
  }
  function deleteTrainee(id) {
    const prev = trainees
    setTrainees(p => p.filter(x => x.id !== id))
    trainingAPI.trainees.remove(id)
      .then(() => showToast('Trainee Deleted', 'Trainee removed successfully.'))
      .catch(() => {
        setTrainees(prev)
        showToast('Error', 'Failed to delete trainee. Please try again.')
      })
  }
  function approveCert(traineeId) {
    const c = certs.find(x => x.trainee === traineeId && x.st === 'Pending')
    if (!c) return
    const prev = certs
    setCerts(p => p.map(x => x.trainee === traineeId && x.st === 'Pending' ? { ...x, st:'Issued', issued:'Apr 13, 2026', expiry:'Apr 13, 2028' } : x))
    trainingAPI.certs.update(c.id, { st:'Issued', issued:'Apr 13, 2026', expiry:'Apr 13, 2028' })
      .then(() => showToast('Certificate Approved', `${traineeId} certificate issued.`))
      .catch(() => {
        setCerts(prev)
        showToast('Error', 'Failed to approve certificate. Please try again.')
      })
  }

  const unreadCount = notifs.filter(n => !n.read).length
  const shared = { sessions, setSessions, batches, setBatches, attendance, setAttendance, resources, setResources, assessments, setAssessments, certs, setCerts, feedback, setFeedback, trainees, setTrainees, notifs, setNotifs, canEdit, canApprove, isAdmin, isHead, isMgmt, isUser, isTrainee, isTrainer, showToast, setModal, deleteSession, deleteBatch, deleteResource, deleteAssessment, deleteCert, deleteTrainee, approveCert }

  return (
    <ModuleTabColumn style={{ fontFamily: 'inherit', color: C.t1 }}>
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
        <Suspense fallback={<TrainingSubTabFallback />}>
          <TabKPI {...shared} />
        </Suspense>
      )}
      {activeTab === 'calendar' && (
        <Suspense fallback={<TrainingSubTabFallback />}>
          <TabCalendar {...shared} onShowSession={s => { setSessDet(s); setModal({ type:'sessDetail', data:null }) }} />
        </Suspense>
      )}
      {activeTab === 'batches' && (
        <Suspense fallback={<TrainingSubTabFallback />}>
          <TabBatches {...shared} />
        </Suspense>
      )}
      {activeTab === 'attendance' && (
        <Suspense fallback={<TrainingSubTabFallback />}>
          <TabAttendance {...shared} onOpenAtt={() => setModal({ type:'att', data:null })} />
        </Suspense>
      )}
      {activeTab === 'resources' && (
        <Suspense fallback={<TrainingSubTabFallback />}>
          <TabResources {...shared} />
        </Suspense>
      )}
      {activeTab === 'assessments' && (
        <Suspense fallback={<TrainingSubTabFallback />}>
          <TabAssessments {...shared} onOpenAdd={() => setModal({ type:'assess', data:null })} onShowProfile={n => { setProfName(n); setModal({ type:'profile', data:null }) }} />
        </Suspense>
      )}
      {activeTab === 'certs' && (
        <Suspense fallback={<TrainingSubTabFallback />}>
          <TabCerts {...shared} onShowProfile={n => { setProfName(n); setModal({ type:'profile', data:null }) }} />
        </Suspense>
      )}
      {activeTab === 'feedback' && (
        <Suspense fallback={<TrainingSubTabFallback />}>
          <TabFeedback {...shared} onOpenFeedback={() => setModal({ type:'feedback', data:null })} />
        </Suspense>
      )}
      {activeTab === 'analytics' && (
        <Suspense fallback={<TrainingSubTabFallback />}>
          <TabAnalytics {...shared} />
        </Suspense>
      )}
      {activeTab === 'trainees' && (
        <Suspense fallback={<TrainingSubTabFallback />}>
          <TabTrainees {...shared} onShowProfile={n => { setProfName(n); setModal({ type:'profile', data:null }) }} />
        </Suspense>
      )}
      {activeTab === 'skillgap' && (
        <Suspense fallback={<TrainingSubTabFallback />}>
          <TabSkillGap {...shared} />
        </Suspense>
      )}

      {modal.type === 'session'   && <ModalSession    initial={modal.data} onClose={closeModal} onSave={saveSession} />}
      {modal.type === 'batch'     && <ModalBatch      initial={modal.data} onClose={closeModal} onSave={saveBatch} />}
      {modal.type === 'resource'  && <ModalResource   initial={modal.data} onClose={closeModal} onSave={saveResource} />}
      {modal.type === 'att'       && <ModalAttendance onClose={closeModal} showToast={showToast} onSaveRecord={(r) => setAttendance(p => [r, ...p])} />}
      {modal.type === 'assess'    && <ModalAssessment initial={modal.data} onClose={closeModal} onSave={saveAssessment} />}
      {modal.type === 'cert'      && <ModalCert       initial={modal.data} onClose={closeModal} onSave={saveCert} />}
      {modal.type === 'trainee'   && <ModalTrainee    initial={modal.data} onClose={closeModal} onSave={saveTrainee} />}
      {modal.type === 'feedback'  && <ModalFeedback   onClose={closeModal} onAdd={addFeedback} />}
      {modal.type === 'profile'   && profName && <ModalProfile name={profName} trainees={trainees} assessments={assessments} certs={certs} canEdit={canEdit} showToast={showToast} onClose={closeModal} />}
      {modal.type === 'sessDetail'&& sessDet  && <ModalSessionDetail sess={sessDet} onClose={closeModal} onMarkAtt={() => { setModal({ type:'att', data:null }) }} />}

      {notifOpen && <NotifPanel notifs={notifs} setNotifs={setNotifs} onClose={() => setNotifOpen(false)} />}
      <Toast t={toast} />
    </ModuleTabColumn>
  )
}
