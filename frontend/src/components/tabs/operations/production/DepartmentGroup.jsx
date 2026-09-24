import { DEPT_HEADER_ICON } from './loopcProductionDepartments'
import { groupStatusLabel } from './productionSheetUtils'
import DepartmentTable from './DepartmentTable'

const groupWrap = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  minWidth: 0,
}

const headerBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #94A3B8',
  borderRadius: '0.375rem',
  background: '#F1F5F9',
  padding: '0.55rem 0.85rem',
  cursor: 'pointer',
  textAlign: 'left',
  color: '#0F172A',
}

const headerOpen = {
  ...headerBtn,
  borderRadius: '0.375rem 0.375rem 0 0',
  borderBottom: '1px solid #CBD5E1',
  background: '#E2E8F0',
}

const nameStyle = {
  fontSize: '0.95rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  flex: 1,
}

const meta = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#475569',
  whiteSpace: 'nowrap',
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
 * Expandable department group with independent DepartmentTable.
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
}) {
  const count = rows?.length || 0
  const status = groupStatusLabel(rows || [])
  const icon = DEPT_HEADER_ICON[department.key] || '●'
  const open = Boolean(expanded)

  return (
    <section style={groupWrap}>
      <button
        type="button"
        style={open ? headerOpen : headerBtn}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span style={{ fontWeight: 800, width: '1.1rem' }}>{open ? '▼' : '▶'}</span>
        <span style={{ fontSize: '1rem', opacity: 0.85 }} aria-hidden>{icon}</span>
        <span style={nameStyle}>{department.label}</span>
        <span style={meta}>{count} {count === 1 ? 'Record' : 'Records'}</span>
        <span style={statusPill(status)}>{status}</span>
      </button>
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
