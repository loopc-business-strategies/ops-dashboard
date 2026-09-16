import { useCallback, useEffect, useState } from 'react'
import hrAPI from '../../api/hr'
import { isStructuredPayrollEnabled } from '../../config/tenantBranding'

const DEPARTMENTS = [
  { value: '',            label: 'Select department' },
  { value: 'production',  label: 'Production & Factory' },
  { value: 'hr',          label: 'Hiring & HR' },
  { value: 'finance',     label: 'Finance & Accounts' },
  { value: 'government',  label: 'Govt. & Compliance' },
  { value: 'sales',       label: 'Sales & Marketing' },
  { value: 'operations',  label: 'Operations & Logistics' },
  { value: 'training',    label: 'Training & Development' },
  { value: 'management',  label: 'Management' },
]

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'TERMINATED', label: 'Terminated' },
]

const EMPTY_COMPONENT = { code: '', label: '', amount: 0 }

function ComponentEditor({ title, items, onChange, emptyHint }) {
  const update = (idx, field, value) => {
    const next = items.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    onChange(next)
  }
  const add = () => onChange([...items, { ...EMPTY_COMPONENT }])
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <button type="button" onClick={add} className="text-xs font-semibold text-slate-600 hover:text-slate-900">
          + Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">{emptyHint}</p>
      ) : (
        <div className="space-y-2">
          {items.map((row, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <input
                className="col-span-3 rounded border border-slate-200 px-2 py-1.5 text-xs"
                placeholder="Code"
                value={row.code}
                onChange={(e) => update(idx, 'code', e.target.value)}
              />
              <input
                className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-xs"
                placeholder="Label"
                value={row.label}
                onChange={(e) => update(idx, 'label', e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="col-span-3 rounded border border-slate-200 px-2 py-1.5 text-xs"
                placeholder="Amount"
                value={row.amount}
                onChange={(e) => update(idx, 'amount', Number(e.target.value))}
              />
              <button type="button" onClick={() => remove(idx)} className="col-span-1 text-xs text-red-500">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * LoopC employee profile drawer: Personal / Employment / Salary & Payroll.
 */
export default function EmployeeProfileDrawer({ token, company, employeeId, onClose, onSaved }) {
  const structured = isStructuredPayrollEnabled(company)
  const [tab, setTab] = useState('personal')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const [assignment, setAssignment] = useState({
    earnings: [],
    deductions: [],
    employerContributions: [],
    notes: '',
  })
  const [hasAssignment, setHasAssignment] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const empRes = await hrAPI.getEmployee(token, employeeId)
      const emp = empRes.employee
      setForm({
        name: emp.name || '',
        idNumber: emp.idNumber || '',
        employeeCode: emp.employeeCode || '',
        email: emp.email || '',
        phoneNumber: emp.phoneNumber || '',
        address: emp.address || '',
        emergencyContactName: emp.emergencyContactName || '',
        emergencyContactPhone: emp.emergencyContactPhone || '',
        department: emp.department || '',
        position: emp.position || '',
        joiningDate: emp.joiningDate ? String(emp.joiningDate).slice(0, 10) : '',
        status: emp.status || 'ACTIVE',
        shift: emp.shift || '',
        managerName: emp.managerName || '',
        contractRef: emp.contractRef || '',
        salaryRef: emp.salaryRef || '',
        rating: emp.rating || 3,
      })

      if (structured) {
        try {
          const asgRes = await hrAPI.getSalaryAssignment(token, employeeId)
          const data = asgRes.data
          if (data) {
            setHasAssignment(true)
            setAssignment({
              earnings: data.earnings || [],
              deductions: data.deductions || [],
              employerContributions: data.employerContributions || [],
              notes: data.notes || '',
            })
          } else {
            setHasAssignment(false)
            setAssignment({ earnings: [], deductions: [], employerContributions: [], notes: '' })
          }
        } catch {
          setHasAssignment(false)
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load employee.')
    } finally {
      setLoading(false)
    }
  }, [token, employeeId, structured])

  useEffect(() => { load() }, [load])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const saveProfile = async () => {
    setSaving(true)
    setError('')
    try {
      await hrAPI.updateEmployee(token, employeeId, form)
      onSaved?.()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save employee.')
    } finally {
      setSaving(false)
    }
  }

  const saveSalary = async () => {
    setSaving(true)
    setError('')
    try {
      const clean = (rows) =>
        (rows || [])
          .filter((r) => String(r.code || '').trim())
          .map((r) => ({
            code: String(r.code).trim(),
            label: String(r.label || r.code).trim(),
            amount: Number(r.amount) || 0,
          }))
      await hrAPI.putSalaryAssignment(token, employeeId, {
        earnings: clean(assignment.earnings),
        deductions: clean(assignment.deductions),
        employerContributions: clean(assignment.employerContributions),
        notes: assignment.notes || '',
      })
      setHasAssignment(true)
      onSaved?.()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save salary assignment.')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'personal', label: 'Personal' },
    { id: 'employment', label: 'Employment' },
    ...(structured ? [{ id: 'salary', label: 'Salary & Payroll' }] : []),
  ]

  return (
    <div className="fixed inset-0 z-[960] flex justify-end bg-slate-950/40 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-950">Employee profile</h3>
            <p className="mt-1 text-sm text-slate-500">{form?.name || '…'}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">✕</button>
        </div>

        <div className="flex gap-2 border-b border-slate-100 px-5 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading || !form ? (
            <div className="py-16 text-center text-sm text-slate-500">Loading…</div>
          ) : (
            <>
              {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
              )}

              {tab === 'personal' && (
                <div className="grid gap-3">
                  {[
                    ['name', 'Full name'],
                    ['idNumber', 'ID number'],
                    ['employeeCode', 'Employee code'],
                    ['email', 'Email'],
                    ['phoneNumber', 'Phone'],
                    ['emergencyContactName', 'Emergency contact'],
                    ['emergencyContactPhone', 'Emergency phone'],
                  ].map(([key, label]) => (
                    <label key={key} className="block text-xs font-semibold text-slate-600">
                      {label}
                      <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form[key]} onChange={set(key)} />
                    </label>
                  ))}
                  <label className="block text-xs font-semibold text-slate-600">
                    Address
                    <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={3} value={form.address} onChange={set('address')} />
                  </label>
                </div>
              )}

              {tab === 'employment' && (
                <div className="grid gap-3">
                  <label className="block text-xs font-semibold text-slate-600">
                    Department
                    <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.department} onChange={set('department')}>
                      {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Position
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.position} onChange={set('position')} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Joining date
                    <input type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.joiningDate} onChange={set('joiningDate')} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Status
                    <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.status} onChange={set('status')}>
                      {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Shift
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.shift} onChange={set('shift')} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Manager
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.managerName} onChange={set('managerName')} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Contract ref
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.contractRef} onChange={set('contractRef')} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Salary ref (legacy note)
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.salaryRef} onChange={set('salaryRef')} />
                  </label>
                </div>
              )}

              {tab === 'salary' && structured && (
                <div className="space-y-5">
                  {!hasAssignment && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                      No salary structure configured yet. Add earnings/deductions below — nothing is auto-filled from legacy payroll.
                    </div>
                  )}
                  <ComponentEditor
                    title="Earnings"
                    items={assignment.earnings}
                    onChange={(earnings) => setAssignment((a) => ({ ...a, earnings }))}
                    emptyHint="No earnings components."
                  />
                  <ComponentEditor
                    title="Deductions"
                    items={assignment.deductions}
                    onChange={(deductions) => setAssignment((a) => ({ ...a, deductions }))}
                    emptyHint="No deduction components."
                  />
                  <ComponentEditor
                    title="Employer contributions"
                    items={assignment.employerContributions}
                    onChange={(employerContributions) => setAssignment((a) => ({ ...a, employerContributions }))}
                    emptyHint="No employer contribution components."
                  />
                  <label className="block text-xs font-semibold text-slate-600">
                    Notes
                    <textarea
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows={2}
                      value={assignment.notes}
                      onChange={(e) => setAssignment((a) => ({ ...a, notes: e.target.value }))}
                    />
                  </label>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
            Close
          </button>
          {tab === 'salary' && structured ? (
            <button
              type="button"
              disabled={saving || loading}
              onClick={saveSalary}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--brand-button-bg, var(--brand-dark))' }}
            >
              {saving ? 'Saving…' : 'Save salary structure'}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || loading}
              onClick={saveProfile}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--brand-button-bg, var(--brand-dark))' }}
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
