import { LOOPC_PRODUCTION_DEPARTMENTS } from './loopcProductionDepartments'
import { resolveDatePreset } from './productionSheetUtils'

const bar = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem',
  background: '#F8FAFC',
  border: '1px solid #CBD5E1',
  borderRadius: '0.5rem',
  padding: '0.85rem 1rem',
}

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: '0.65rem 0.75rem',
  width: '100%',
}

const field = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  minWidth: 0,
}

const labelStyle = {
  fontSize: '0.7rem',
  fontWeight: 700,
  color: '#475569',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

const control = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #94A3B8',
  borderRadius: '0.375rem',
  padding: '0.4rem 0.5rem',
  fontSize: '0.85rem',
  color: '#0F172A',
  background: '#FFFFFF',
}

const actions = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
}

const btnPrimary = {
  border: '1px solid var(--brand-primary, #166534)',
  background: 'var(--brand-primary, #166534)',
  color: '#FFFFFF',
  fontWeight: 700,
  fontSize: '0.85rem',
  borderRadius: '0.375rem',
  padding: '0.45rem 0.9rem',
  cursor: 'pointer',
}

const btnGhost = {
  border: '1px solid #94A3B8',
  background: '#FFFFFF',
  color: '#0F172A',
  fontWeight: 600,
  fontSize: '0.85rem',
  borderRadius: '0.375rem',
  padding: '0.45rem 0.9rem',
  cursor: 'pointer',
}

const presetBtn = (active) => ({
  border: active ? '1px solid var(--brand-primary, #166534)' : '1px solid #CBD5E1',
  background: active ? 'rgba(22, 101, 52, 0.08)' : '#FFFFFF',
  color: active ? 'var(--brand-primary, #166534)' : '#334155',
  fontWeight: 600,
  fontSize: '0.78rem',
  borderRadius: '0.375rem',
  padding: '0.3rem 0.65rem',
  cursor: 'pointer',
})

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'custom', label: 'Custom Date Range' },
]

/**
 * Global filter bar for LoopC Production sheets.
 * Draft vs applied: Apply commits draft to parent.
 */
export default function ProductionFilters({
  draft,
  onDraftChange,
  onApply,
  onClear,
  employeeOptions = [],
  managerOptions = [],
  titleOptions = [],
}) {
  const setField = (key, value) => {
    onDraftChange({ ...draft, [key]: value })
  }

  const applyPreset = (presetId) => {
    if (presetId === 'custom') {
      onDraftChange({ ...draft, datePreset: 'custom' })
      return
    }
    const range = resolveDatePreset(presetId)
    onDraftChange({
      ...draft,
      datePreset: presetId,
      dateFrom: range?.dateFrom || '',
      dateTo: range?.dateTo || '',
    })
  }

  return (
    <div style={bar}>
      <div style={actions}>
        <span style={{ ...labelStyle, marginRight: '0.25rem' }}>Date</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            style={presetBtn(draft.datePreset === p.id)}
            onClick={() => applyPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={grid} className="loopc-prod-filters-grid">
        <label style={field}>
          <span style={labelStyle}>Title</span>
          <input
            list="loopc-prod-titles"
            style={control}
            value={draft.title || ''}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="Search / select title"
          />
          <datalist id="loopc-prod-titles">
            {titleOptions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>

        <label style={field}>
          <span style={labelStyle}>Department</span>
          <select
            style={control}
            value={draft.department || ''}
            onChange={(e) => setField('department', e.target.value)}
          >
            <option value="">All departments</option>
            {LOOPC_PRODUCTION_DEPARTMENTS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </label>

        <label style={field}>
          <span style={labelStyle}>Date From</span>
          <input
            type="date"
            style={control}
            value={draft.dateFrom || ''}
            onChange={(e) => onDraftChange({
              ...draft,
              dateFrom: e.target.value,
              datePreset: 'custom',
            })}
          />
        </label>

        <label style={field}>
          <span style={labelStyle}>Date To</span>
          <input
            type="date"
            style={control}
            value={draft.dateTo || ''}
            onChange={(e) => onDraftChange({
              ...draft,
              dateTo: e.target.value,
              datePreset: 'custom',
            })}
          />
        </label>

        <label style={field}>
          <span style={labelStyle}>Employee</span>
          <select
            style={control}
            value={draft.employee || ''}
            onChange={(e) => setField('employee', e.target.value)}
          >
            <option value="">All employees</option>
            {employeeOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>

        <label style={field}>
          <span style={labelStyle}>Department Manager</span>
          <select
            style={control}
            value={draft.departmentManager || ''}
            onChange={(e) => setField('departmentManager', e.target.value)}
          >
            <option value="">All managers</option>
            {managerOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>

        <label style={field}>
          <span style={labelStyle}>Batch</span>
          <input
            style={control}
            value={draft.batch || ''}
            onChange={(e) => setField('batch', e.target.value)}
            placeholder="Search batch"
          />
        </label>

        <label style={field}>
          <span style={labelStyle}>Status</span>
          <select
            style={control}
            value={draft.status || ''}
            onChange={(e) => setField('status', e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="Running">Running</option>
            <option value="Idle">Idle</option>
            <option value="Completed">Completed</option>
          </select>
        </label>

        <label style={field}>
          <span style={labelStyle}>Shift</span>
          <select
            style={control}
            value={draft.shift || ''}
            onChange={(e) => setField('shift', e.target.value)}
          >
            <option value="">All shifts</option>
            <option value="Morning">Morning</option>
            <option value="Afternoon">Afternoon</option>
            <option value="Night">Night</option>
          </select>
        </label>

        <label style={field}>
          <span style={labelStyle}>Search</span>
          <input
            style={control}
            value={draft.search || ''}
            onChange={(e) => setField('search', e.target.value)}
            placeholder="Search rows…"
          />
        </label>
      </div>

      <div style={actions}>
        <button type="button" style={btnPrimary} onClick={onApply}>Apply Filters</button>
        <button type="button" style={btnGhost} onClick={onClear}>Clear Filters</button>
      </div>

      <style>{`
        @media (max-width: 1200px) {
          .loopc-prod-filters-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 720px) {
          .loopc-prod-filters-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  )
}
