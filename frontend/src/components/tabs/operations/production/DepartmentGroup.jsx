import { DEPT_HEADER_ICON } from './loopcProductionDepartments'
import { groupStatusLabel } from './productionSheetUtils'
import DepartmentTable from './DepartmentTable'

const groupWrap = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  minWidth: 0,
}

const headerBar = {
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: '0.55rem 0.75rem',
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #94A3B8',
  borderRadius: '0.375rem',
  background: '#F1F5F9',
  padding: '0.55rem 0.85rem',
  color: '#0F172A',
  overflowX: 'auto',
}

const headerBarOpen = {
  ...headerBar,
  borderRadius: '0.375rem 0.375rem 0 0',
  borderBottom: '1px solid #CBD5E1',
  background: '#E2E8F0',
}

const expandBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.55rem',
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  minWidth: 0,
  flex: '1 1 auto',
}

const nameStyle = {
  fontSize: '0.95rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const meta = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#475569',
  whiteSpace: 'nowrap',
}

const filterCluster = {
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: '0.35rem 0.5rem',
  marginLeft: 'auto',
  flexShrink: 0,
  whiteSpace: 'nowrap',
}

const filterLabel = {
  fontSize: '0.68rem',
  fontWeight: 700,
  color: '#475569',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

const dateInput = {
  boxSizing: 'border-box',
  border: '1px solid #94A3B8',
  borderRadius: '0.25rem',
  padding: '0.25rem 0.4rem',
  fontSize: '0.8rem',
  color: '#0F172A',
  background: '#FFFFFF',
  maxWidth: '9.5rem',
}

const clearBtn = {
  border: '1px solid #94A3B8',
  borderRadius: '0.25rem',
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  background: '#FFFFFF',
  color: '#334155',
}

const statusPill = (label) => {
  let bg = '#F1F5F9'
  let color = '#334155'
  if (label === 'Running') {
    bg = '#DCFCE7'
    color = '#166534'
  } else if (label === 'Completed') {
    bg = '#DBEAFE'
    color = '#1E40AF'
  } else if (label === 'Idle') {
    bg = '#FEF3C7'
    color = '#92400E'
  } else if (label === 'Empty') {
    bg = '#F8FAFC'
    color = '#94A3B8'
  }
  return {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.2rem 0.55rem',
    borderRadius: '0.25rem',
    background: bg,
    color,
  }
}

/**
 * Expandable department group with independent DepartmentTable + heading date filters.
 */
export default function DepartmentGroup({
  department,
  rows,
  expanded,
  onToggle,
  editable = false,
  savingId = null,
  onSaveRow,
  onDeleteRow,
  onAddRow,
  dateFrom = '',
  dateTo = '',
  onDateFilterChange,
}) {
  const count = rows?.length || 0
  const status = groupStatusLabel(rows || [])
  const icon = DEPT_HEADER_ICON[department.key] || '●'
  const open = Boolean(expanded)
  const hasDeptDate = Boolean(dateFrom || dateTo)

  const setDate = (patch) => {
    onDateFilterChange?.({
      dateFrom: dateFrom || '',
      dateTo: dateTo || '',
      ...patch,
    })
  }

  return (
    <section style={groupWrap}>
      <div style={open ? headerBarOpen : headerBar}>
        <button
          type="button"
          style={expandBtn}
          onClick={onToggle}
          aria-expanded={open}
        >
          <span style={{ fontWeight: 800, width: '1.1rem' }}>{open ? '▼' : '▶'}</span>
          <span style={{ fontSize: '1rem', opacity: 0.85 }} aria-hidden>{icon}</span>
          <span style={nameStyle}>{department.label}</span>
          <span style={{ ...meta, marginLeft: '0.5rem' }}>
            {count} {count === 1 ? 'Record' : 'Records'}
          </span>
          <span style={{ ...statusPill(status), marginLeft: '0.35rem' }}>{status}</span>
        </button>

        <div
          style={filterCluster}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <span style={filterLabel}>From</span>
          <input
            type="date"
            aria-label={`${department.label} date from`}
            style={dateInput}
            value={dateFrom || ''}
            onChange={(e) => setDate({ dateFrom: e.target.value })}
          />
          <span style={filterLabel}>To</span>
          <input
            type="date"
            aria-label={`${department.label} date to`}
            style={dateInput}
            value={dateTo || ''}
            onChange={(e) => setDate({ dateTo: e.target.value })}
          />
          {hasDeptDate ? (
            <button
              type="button"
              style={clearBtn}
              onClick={() => setDate({ dateFrom: '', dateTo: '' })}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
      {open ? (
        <DepartmentTable
          rows={rows}
          editable={editable}
          savingId={savingId}
          onSaveRow={onSaveRow}
          onDeleteRow={onDeleteRow}
          onAddRow={onAddRow}
        />
      ) : null}
    </section>
  )
}
