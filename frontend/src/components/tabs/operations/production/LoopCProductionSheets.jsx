import { useEffect, useMemo, useState } from 'react'
import { productionControlApi } from '../../../../api/productionControl'
import { LOOPC_PRODUCTION_DEPARTMENTS } from './loopcProductionDepartments'
import ProductionSummary from './ProductionSummary'
import ProductionFilters from './ProductionFilters'
import DepartmentGroup from './DepartmentGroup'
import {
  EMPTY_FILTERS,
  applyGlobalFilters,
  computeSummary,
  fetchAllBatches,
  mapBatchToRow,
  uniqueOptions,
} from './productionSheetUtils'

const wrap = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  width: '100%',
  minWidth: 0,
}

/**
 * LoopC Operations → Production: Excel-style department workbook.
 */
export default function LoopCProductionSheets() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draftFilters, setDraftFilters] = useState({ ...EMPTY_FILTERS })
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS })
  const [expanded, setExpanded] = useState(() => {
    const init = {}
    LOOPC_PRODUCTION_DEPARTMENTS.forEach((d) => { init[d.key] = true })
    return init
  })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const list = await fetchAllBatches(productionControlApi.listBatches)
        if (mounted) setBatches(Array.isArray(list) ? list : [])
      } catch (err) {
        if (mounted) {
          setBatches([])
          setError(err?.response?.data?.message || err?.message || 'Failed to load production batches')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const allRows = useMemo(
    () => (Array.isArray(batches) ? batches : []).map(mapBatchToRow),
    [batches],
  )

  const filteredRows = useMemo(
    () => applyGlobalFilters(allRows, appliedFilters),
    [allRows, appliedFilters],
  )

  const summary = useMemo(() => computeSummary(filteredRows), [filteredRows])

  const groups = useMemo(() => {
    const byDept = new Map()
    LOOPC_PRODUCTION_DEPARTMENTS.forEach((d) => byDept.set(d.key, []))
    filteredRows.forEach((row) => {
      if (!row.deptKey || !byDept.has(row.deptKey)) return
      byDept.get(row.deptKey).push(row)
    })
    return LOOPC_PRODUCTION_DEPARTMENTS.map((dept) => ({
      department: dept,
      rows: byDept.get(dept.key) || [],
    }))
  }, [filteredRows])

  const employeeOptions = useMemo(() => uniqueOptions(allRows, 'employee'), [allRows])
  const managerOptions = useMemo(() => uniqueOptions(allRows, 'departmentManager'), [allRows])
  const titleOptions = useMemo(() => uniqueOptions(allRows, 'title'), [allRows])

  const handleApply = () => setAppliedFilters({ ...draftFilters })
  const handleClear = () => {
    setDraftFilters({ ...EMPTY_FILTERS })
    setAppliedFilters({ ...EMPTY_FILTERS })
  }

  const toggleDept = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div style={wrap}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
          Production
        </h2>
        <p style={{ margin: '0.3rem 0 0', color: '#64748B', fontSize: '0.85rem' }}>
          Department workbook — filters apply across all department tables.
        </p>
      </div>

      <ProductionSummary summary={summary} />

      <ProductionFilters
        draft={draftFilters}
        onDraftChange={setDraftFilters}
        onApply={handleApply}
        onClear={handleClear}
        employeeOptions={employeeOptions}
        managerOptions={managerOptions}
        titleOptions={titleOptions}
      />

      {loading ? (
        <div style={{ color: '#64748B', fontSize: '0.875rem' }}>Loading production sheets…</div>
      ) : null}
      {error ? (
        <div style={{ color: '#B91C1C', fontSize: '0.875rem' }}>{error}</div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {groups.map(({ department, rows }) => (
          <DepartmentGroup
            key={department.key}
            department={department}
            rows={rows}
            expanded={expanded[department.key] !== false}
            onToggle={() => toggleDept(department.key)}
          />
        ))}
      </div>
    </div>
  )
}
