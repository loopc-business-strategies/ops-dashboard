// FILE: src/components/tabs/FinanceTab.jsx
// Finance & Accounts — shell: state/orchestration + lazy panels

import { lazy, Suspense, useState, useMemo, useEffect } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useDashboardModuleSubTab } from '../../hooks/useDashboardModuleSubTab'
import financeAPI from '../../api/finance'
import erpAccountingAPI from '../../api/erp-accounting'
import { ErpSubTabButton, ModulePageHeading, ModuleSubTabRow, ModuleTabColumn } from '../layout/ModuleTabChrome'
import { BudgetModal, ExpenseModal, InvoiceModal, PayrollModal } from './finance/FinanceModals'
import { C, fmtFull, setFinanceBaseCurrencyCode } from './finance/ui'
import {
  getFinanceTabs,
  INIT_INVOICES,
  INIT_EXPENSES,
  INIT_PAYROLL,
  BUDGETS,
  RECEIVABLES,
  PAYABLES,
  TAXES,
  INIT_AUDIT,
  INIT_NOTIFS,
} from './finance/financeSeedData'
import { NotificationsPanel } from './finance/NotificationsPanel'

const KPIOverview = lazy(() => import('./finance/KPIOverview'))
const RevenueTracking = lazy(() => import('./finance/RevenueTracking'))
const ExpenseManagement = lazy(() => import('./finance/ExpenseManagement'))
const InvoiceManagement = lazy(() => import('./finance/InvoiceManagement'))
const BudgetPlanning = lazy(() => import('./finance/BudgetPlanning'))
const PayrollManagement = lazy(() => import('./finance/PayrollManagement'))
const ARAndAP = lazy(() => import('./finance/ARAndAP'))
const GoldTracker = lazy(() => import('./finance/GoldTracker'))
const TaxCompliance = lazy(() => import('./finance/TaxCompliance'))
const ReportsAnalytics = lazy(() => import('./finance/ReportsAnalytics'))
const GeneralLedger = lazy(() => import('./finance/GeneralLedger'))
const AuditTrail = lazy(() => import('./finance/AuditTrail'))

function FinanceSubTabFallback() {
  return (
    <div style={{ padding: '1rem', color: '#6B7280', fontSize: '0.875rem' }}>
      Loading…
    </div>
  )
}

export default function FinanceTab() {
  const { isSuperAdmin, isManagement, isDepartmentHead, isDepartmentUser, isExternal } = usePermissions()
  const { user, token, company } = useAuth()
  const { t } = useLanguage()
  const TABS = useMemo(() => getFinanceTabs(t), [t])
  const allowedSubIds = useMemo(() => TABS.map((tabItem) => tabItem.id), [TABS])
  const { subTab: activeTab, buildSubHref, handleSubTabClick } = useDashboardModuleSubTab(
    'finance',
    allowedSubIds,
    'kpi',
    company,
  )

  // Map dashboard roles → finance-specific role
  const finRole = useMemo(() => {
    if (isSuperAdmin)    return 'superadmin'
    if (isManagement)    return 'fin_mgr'
    if (isDepartmentHead) {
      if (user?.department === 'hr')    return 'hr_mgr'
      if (user?.department === 'sales') return 'sales_head'
      return 'dept_head'
    }
    if (isDepartmentUser) {
      if (user?.department === 'hr')    return 'hr_mgr'
      if (user?.department === 'sales') return 'sales_head'
      return 'fin_analyst'
    }
    if (isExternal) return 'vendor'
    return 'fin_analyst'
  }, [isSuperAdmin, isManagement, isDepartmentHead, isDepartmentUser, isExternal, user])

  const can     = (...roles) => roles.includes(finRole)
  const canEdit = ()         => can('superadmin','fin_mgr')
  const USE_SEED_DATA =
    !import.meta.env.PROD
    && import.meta.env.DEV
    && String(import.meta.env.VITE_ENABLE_SEED_DATA || '').toLowerCase() === 'true'

  const [invoices,     setInvoices]     = useState(USE_SEED_DATA ? INIT_INVOICES : [])
  const [expenses,     setExpenses]     = useState(USE_SEED_DATA ? INIT_EXPENSES : [])
  const [payroll,      setPayroll]      = useState(USE_SEED_DATA ? INIT_PAYROLL : [])
  const [budgets,      setBudgets]      = useState(USE_SEED_DATA ? BUDGETS : [])
  const [taxes,        setTaxes]        = useState(USE_SEED_DATA ? TAXES : [])
  const [receivables,  setReceivables]  = useState(USE_SEED_DATA ? RECEIVABLES : [])
  const [payables,     setPayables]     = useState(USE_SEED_DATA ? PAYABLES : [])
  const [auditLog,     setAuditLog]     = useState(USE_SEED_DATA ? INIT_AUDIT : [])
  const [notifications,setNotifications]= useState(USE_SEED_DATA ? INIT_NOTIFS : [])
  const [toast,        setToast]        = useState(null)
  const [modal,        setModal]        = useState(null)   // 'invoice'|'expense'|'payroll'|'budget'|null
  const [notifOpen,    setNotifOpen]    = useState(false)
  const [baseCurrencyCode, setBaseCurrencyCode] = useState('USD')

  useEffect(() => {
    setFinanceBaseCurrencyCode(baseCurrencyCode)
  }, [baseCurrencyCode])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    erpAccountingAPI.getCurrencies(token)
      .then((res) => {
        if (cancelled) return
        const list = res?.currencies || res || []
        const base = (Array.isArray(list) ? list : []).find((c) => c.baseCurrency)
        const code = String(base?.code || 'USD').trim().toUpperCase() || 'USD'
        setBaseCurrencyCode(code)
      })
      .catch(() => { /* keep USD default */ })
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const norm = rows => (rows || []).map(r => ({ ...r, id: r._id?.toString() || r.id }))
    Promise.all([
      financeAPI.invoices.list(),
      financeAPI.expenses.list(),
      financeAPI.payroll.list(),
      financeAPI.budgets.list(),
      financeAPI.taxes.list(),
    ]).then(([invs, exps, pays, buds, taxs]) => {
      if (cancelled) return
      if (invs.length)  setInvoices(norm(invs))
      if (exps.length)  setExpenses(norm(exps))
      if (pays.length)  setPayroll(norm(pays))
      if (buds.length)  setBudgets(norm(buds))
      if (taxs.length)  setTaxes(norm(taxs))
    }).catch(() => { showToast('Error', 'Failed to load finance data. Showing available records.') })
    return () => { cancelled = true }
  }, [token])

  function showToast(title, msg) {
    setToast({ title, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function addAudit(entry) {
    setAuditLog(p => [entry, ...p])
  }

  const roleNotifs = useMemo(
    () => notifications.filter(n => n.roles.includes(finRole)),
    [notifications, finRole]
  )
  const unreadCount = roleNotifs.filter(n => !n.read).length

  // Shared props passed to every sub-tab
  const sh = { finRole, can, canEdit, invoices, setInvoices, expenses, setExpenses, payroll, setPayroll, budgets, setBudgets, taxes, setTaxes, receivables, setReceivables, payables, setPayables, auditLog, addAudit, onToast:showToast, openModal:setModal, financeApi:financeAPI }

  function renderTab() {
    const fallback = <FinanceSubTabFallback />
    switch (activeTab) {
      case 'kpi':
        return <Suspense fallback={fallback}><KPIOverview {...sh} /></Suspense>
      case 'revenue':
        return <Suspense fallback={fallback}><RevenueTracking {...sh} /></Suspense>
      case 'expense':
        return <Suspense fallback={fallback}><ExpenseManagement {...sh} /></Suspense>
      case 'invoice':
        return <Suspense fallback={fallback}><InvoiceManagement {...sh} /></Suspense>
      case 'budget':
        return <Suspense fallback={fallback}><BudgetPlanning {...sh} /></Suspense>
      case 'payroll':
        return <Suspense fallback={fallback}><PayrollManagement {...sh} /></Suspense>
      case 'arpa':
        return <Suspense fallback={fallback}><ARAndAP {...sh} /></Suspense>
      case 'gold':
        return <Suspense fallback={fallback}><GoldTracker {...sh} /></Suspense>
      case 'tax':
        return <Suspense fallback={fallback}><TaxCompliance {...sh} /></Suspense>
      case 'reports':
        return <Suspense fallback={fallback}><ReportsAnalytics {...sh} /></Suspense>
      case 'ledger':
        return <Suspense fallback={fallback}><GeneralLedger finRole={finRole} can={can} canEdit={canEdit} onToast={showToast} token={token} /></Suspense>
      case 'audit':
        return <Suspense fallback={fallback}><AuditTrail finRole={finRole} can={can} auditLog={auditLog} /></Suspense>
      default:
        return null
    }
  }

  return (
    <>
    <ModuleTabColumn>
      <ModulePageHeading
        title="Finance & Accounts"
        subtitle="April 2026"
        right={(
          <div
            className="notif-bell"
            onClick={() => setNotifOpen(true)}
            title={`${unreadCount} unread finance alerts`}
          >
            🔔
            {unreadCount > 0 && (
              <span className="notif-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </div>
        )}
      />

      <ModuleSubTabRow>
        {TABS.map((t) => (
          <ErpSubTabButton
            key={t.id}
            active={activeTab === t.id}
            href={buildSubHref(t.id)}
            onClick={(event) => handleSubTabClick(t.id, event)}
          >
            {t.label}
          </ErpSubTabButton>
        ))}
      </ModuleSubTabRow>

      {renderTab()}
    </ModuleTabColumn>
      <InvoiceModal
        open={modal==='invoice'}
        onClose={() => setModal(null)}
        onToast={showToast}
        onSubmit={(f, calc) => {
          const amount = calc ? calc.total : (parseFloat(f.qty)||0)*(parseFloat(f.price)||0)+(parseFloat(f.fee)||0)
          const payload = {
            client: f.client,
            invoiceType: f.type.includes('Sales') ? 'Sales' : 'Purchase',
            amount,
            issueDate: new Date().toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}),
            dueDate: f.due || '',
            status: 'Draft',
            daysOverdue: 0,
          }
          financeAPI.invoices.create(payload).then(doc => {
            const row = { ...doc, id: doc._id?.toString() || doc.id, type: doc.invoiceType, issue: doc.issueDate, due: doc.dueDate }
            setInvoices(p => [row, ...p])
            addAudit({ action:'Invoice Created', user:'You', urole:'Finance Manager', amount:fmtFull(amount), dt:'Now', ip:'192.168.1.x', before:'—', after:(doc.invoiceNo||doc._id)+' Created' })
            showToast('Invoice Created', 'Invoice created as Draft — ready to send to '+f.client)
          }).catch(() => showToast('Error', 'Failed to create invoice'))
        }}
      />

      <ExpenseModal
        open={modal==='expense'}
        onClose={() => setModal(null)}
        onSubmit={f => {
          const payload = { date:new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}), dept:f.dept, cat:f.cat, amount:f.amount, submittedBy:'You', status:'Pending', approvedBy:'—', flagged:f.flagged, description:f.desc||'' }
          financeAPI.expenses.create(payload).then(doc => {
            setExpenses(p => [{ ...doc, id:doc._id?.toString()||doc.id, by:doc.submittedBy||'You' }, ...p])
            showToast('Expense Submitted', `${f.dept} expense of ${fmtFull(f.amount)} submitted${f.flagged?' — auto-flagged (>$10,000)':''}`)
          }).catch(() => showToast('Error','Failed to submit expense'))
        }}
      />

      <PayrollModal
        open={modal==='payroll'}
        onClose={() => setModal(null)}
        onRun={async (auth, _bank) => {
          const previousPayroll = payroll
          const toProcess = payroll.filter(e => e.status !== 'Processed')
          setPayroll(p => p.map(e => ({ ...e, status:'Processed' })))

          const updates = await Promise.allSettled(toProcess.map(e => {
            const rid = e.id || e._id?.toString()
            if (!rid) return Promise.reject(new Error('Missing payroll id'))
            return financeAPI.payroll.update(rid, { status:'Processed' })
          }))

          const hasFailures = updates.some(r => r.status === 'rejected')
          if (hasFailures) {
            setPayroll(previousPayroll)
            showToast('Error', 'Payroll processing failed for one or more records. No changes were saved.')
            return
          }

          addAudit({ action:'Payroll Run', user:auth||'You', urole:'Finance Manager', amount:'$284,600', dt:'Now', ip:'192.168.1.x', before:'Pending', after:'Processed' })
          showToast('Payroll Processed','April 2026 payroll of $284,600 processed for 47 employees. Salary slips generated.')
        }}
      />

      <BudgetModal
        open={modal==='budget'}
        onClose={() => setModal(null)}
        onSubmit={(dept, amt) => {
          showToast('Request Submitted','Budget increase request for '+(dept||'Department')+' ('+fmtFull(amt)+') sent to Finance Manager for review.')
        }}
      />

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position:'fixed', bottom:22, right:22, minWidth:260, background:'#ffffff', border:`1px solid ${C.border2}`, borderLeft:`3px solid var(--purple)`, borderRadius:10, padding:'13px 18px', zIndex:9999, boxShadow:'0 8px 30px rgba(var(--purple-rgb),0.22)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.t1, marginBottom:3 }}>{toast.title}</div>
          <div style={{ fontSize:12, color:C.t3 }}>{toast.msg}</div>
        </div>
      )}

      {/* ── Finance Notifications Panel ── */}
      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={roleNotifs}
        onAck={id => setNotifications(p => p.map(n => n.id===id ? {...n, read:true} : n))}
        onDismiss={id => setNotifications(p => p.filter(n => n.id!==id))}
        onMarkAllRead={() => setNotifications(p => p.map(n => roleNotifs.find(r=>r.id===n.id) ? {...n, read:true} : n))}
        onClearRead={() => setNotifications(p => p.filter(n => !(n.read && roleNotifs.find(r=>r.id===n.id))))}
      />
    </>
  )
}
