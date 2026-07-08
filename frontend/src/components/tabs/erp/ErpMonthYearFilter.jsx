import { MONTH_OPTIONS, areAllMonthsSelected, normalizeFilterMonths, normalizeFilterYear, selectAllMonths } from './erpListFilters'

export default function ErpMonthYearFilter({
  year,
  months,
  onYearChange,
  onMonthsChange,
  inputStyle,
  yearLabel = 'Year',
}) {
  const currentYear = new Date().getFullYear()
  const selectedMonths = normalizeFilterMonths(months)
  const allMonthsSelected = areAllMonthsSelected(selectedMonths)
  const normalizedYear = normalizeFilterYear(year)
  const yearOptions = []
  for (let y = currentYear; y >= currentYear - 10; y -= 1) {
    yearOptions.push(String(y))
  }
  if (normalizedYear && !yearOptions.includes(normalizedYear)) {
    yearOptions.unshift(normalizedYear)
  }

  const toggleMonth = (monthValue) => {
    const month = Number(monthValue)
    const next = selectedMonths.includes(month)
      ? selectedMonths.filter((value) => value !== month)
      : [...selectedMonths, month]
    onMonthsChange(normalizeFilterMonths(next))
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 140px) 1fr', gap: '0.5rem', alignItems: 'start' }}>
      <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>
        {yearLabel}
        <select
          value={normalizedYear}
          onChange={(event) => onYearChange(normalizeFilterYear(event.target.value))}
          style={inputStyle}
        >
          <option value="">All years</option>
          {yearOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '0.4rem 0.55rem', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>Months</span>
          <button
            type="button"
            onClick={() => onMonthsChange(allMonthsSelected ? [] : selectAllMonths())}
            style={{ border: 'none', background: 'transparent', color: '#1D4ED8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, padding: 0 }}
          >
            {allMonthsSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(52px, 1fr))', gap: '0.3rem' }}>
          {MONTH_OPTIONS.map((month) => (
            <label key={month.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.22rem', fontSize: '0.73rem', color: '#334155' }}>
              <input
                type="checkbox"
                checked={selectedMonths.includes(month.value)}
                onChange={() => toggleMonth(month.value)}
                disabled={!normalizedYear}
              />
              {month.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
