import { formatWeight } from './productionSheetUtils'

const wrap = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: '0.75rem',
  width: '100%',
}

const card = {
  background: '#FFFFFF',
  border: '1px solid #CBD5E1',
  borderRadius: '0.5rem',
  padding: '0.75rem 0.9rem',
  minWidth: 0,
}

const label = {
  margin: 0,
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#64748B',
}

const value = {
  margin: '0.35rem 0 0',
  fontSize: '1.15rem',
  fontWeight: 800,
  color: '#0F172A',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

/**
 * Compact filter-aware summary cards for LoopC Production sheets.
 */
export default function ProductionSummary({ summary }) {
  const s = summary || {}
  const items = [
    { key: 'depts', label: 'Total Departments', value: String(s.totalDepartments ?? 0) },
    { key: 'emps', label: 'Total Employees', value: String(s.totalEmployees ?? 0) },
    { key: 'batches', label: 'Total Batches', value: String(s.totalBatches ?? 0) },
    { key: 'in', label: 'Total Metal IN', value: formatWeight(s.totalMetalIn ?? 0) },
    { key: 'out', label: 'Total Metal OUT', value: formatWeight(s.totalMetalOut ?? 0) },
    { key: 'loss', label: 'Total Metal Loss', value: formatWeight(s.totalMetalLoss ?? 0) },
  ]

  return (
    <div style={wrap} className="loopc-prod-summary">
      {items.map((item) => (
        <div key={item.key} style={card}>
          <p style={label}>{item.label}</p>
          <p style={value}>{item.value}</p>
        </div>
      ))}
      <style>{`
        @media (max-width: 1400px) {
          .loopc-prod-summary { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 800px) {
          .loopc-prod-summary { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  )
}
