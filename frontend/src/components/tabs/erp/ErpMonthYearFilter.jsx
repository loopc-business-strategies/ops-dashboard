import { useEffect, useMemo, useRef, useState } from 'react'
import { MONTH_OPTIONS, areAllMonthsSelected, normalizeFilterMonths, normalizeFilterYear, selectAllMonths } from './erpListFilters'

export default function ErpMonthYearFilter({
  year,
  months,
  onYearChange,
  onMonthsChange,
  inputStyle,
  yearLabel = 'Year',
}) {
  const containerRef = useRef(null)
  const [monthMenuOpen, setMonthMenuOpen] = useState(false)
  const currentYear = new Date().getFullYear()
  const selectedMonths = normalizeFilterMonths(months)
  const allMonthsSelected = areAllMonthsSelected(selectedMonths)
  const normalizedYear = normalizeFilterYear(year)
  const monthsDisabled = !normalizedYear
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

  const monthSummary = useMemo(() => {
    if (!selectedMonths.length) return 'All months'
    if (allMonthsSelected) return 'All months'
    const labels = MONTH_OPTIONS
      .filter((month) => selectedMonths.includes(month.value))
      .map((month) => month.label)
    if (labels.length <= 2) return labels.join(', ')
    return `${labels.length} selected`
  }, [allMonthsSelected, selectedMonths])

  useEffect(() => {
    if (!monthMenuOpen) return undefined
    const onDocumentPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setMonthMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDocumentPointerDown)
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown)
  }, [monthMenuOpen])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 140px) minmax(180px, 260px)', gap: '0.5rem', alignItems: 'start' }}>
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
      <div ref={containerRef} style={{ position: 'relative', display: 'grid', gap: '0.2rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>
        Months
        <button
          type="button"
          onClick={() => {
            if (monthsDisabled) return
            setMonthMenuOpen((prev) => !prev)
          }}
          disabled={monthsDisabled}
          style={{
            ...inputStyle,
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: monthsDisabled ? 'not-allowed' : 'pointer',
            opacity: monthsDisabled ? 0.6 : 1,
          }}
        >
          <span>{monthSummary}</span>
          <span aria-hidden="true">{monthMenuOpen ? '▴' : '▾'}</span>
        </button>
        {monthMenuOpen ? (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              background: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
              padding: '0.45rem 0.5rem',
              zIndex: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>Select months</span>
              <button
                type="button"
                onClick={() => onMonthsChange(allMonthsSelected ? [] : selectAllMonths())}
                style={{ border: 'none', background: 'transparent', color: '#1D4ED8', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, padding: 0 }}
              >
                {allMonthsSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(66px, 1fr))', gap: '0.3rem' }}>
              {MONTH_OPTIONS.map((month) => (
                <label key={month.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.22rem', fontSize: '0.73rem', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={selectedMonths.includes(month.value)}
                    onChange={() => toggleMonth(month.value)}
                  />
                  {month.label}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
