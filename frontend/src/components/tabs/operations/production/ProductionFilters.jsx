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
  gridTemplateColumns: 'repeat(2, minmax(12rem, 16rem))',
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
 * Global date-only filter bar for LoopC Production sheets.
 */
export default function ProductionFilters({
  draft,
  onDraftChange,
  onApply,
  onClear,
}) {
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

      <div style={grid}>
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
      </div>

      <div style={actions}>
        <button type="button" style={btnPrimary} onClick={onApply}>Apply Filters</button>
        <button type="button" style={btnGhost} onClick={onClear}>Clear Filters</button>
      </div>
    </div>
  )
}
