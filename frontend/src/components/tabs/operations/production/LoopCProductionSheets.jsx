import { useCallback, useEffect, useMemo, useState } from 'react'
import { productionControlApi } from '../../../../api/productionControl'
import { LOOPC_PRODUCTION_DEPARTMENTS } from './loopcProductionDepartments'
import ProductionSummary from './ProductionSummary'
import ProductionFilters from './ProductionFilters'
import DepartmentGroup from './DepartmentGroup'
import {
  EMPTY_FILTERS,
  applyDeptDateFilter,
  applyGlobalFilters,
  computeSummary,
  emptyDraftRow,
  fetchAllOperationsEntries,
  mapEntryToRow,
  rowToEntryPayload,
} from './productionSheetUtils'

const wrap = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  width: '100%',
  minWidth: 0,
}

/**
 * LoopC Operations → Production: Excel-style department workbook (CRUD ledger).
 */
export default function LoopCProductionSheets() {
  const [entries, setEntries] = useState([])
  const [draftRows, setDraftRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [draftFilters, setDraftFilters] = useState({ ...EMPTY_FILTERS })
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS })
  const [deptDateFilters, setDeptDateFilters] = useState({})
  const [expanded, setExpanded] = useState(() => {
    const init = {}
    LOOPC_PRODUCTION_DEPARTMENTS.forEach((d) => { init[d.key] = true })
    return init
  })

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchAllOperationsEntries(productionControlApi.listOperationsEntries)
      setEntries(Array.isArray(list) ? list : [])
    } catch (err) {
      setEntries([])
      setError(err?.response?.data?.message || err?.message || 'Failed to load production entries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const list = await fetchAllOperationsEntries(productionControlApi.listOperationsEntries)
        if (mounted) setEntries(Array.isArray(list) ? list : [])
      } catch (err) {
        if (mounted) {
          setEntries([])
          setError(err?.response?.data?.message || err?.message || 'Failed to load production entries')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const allRows = useMemo(() => {
    const mapped = (Array.isArray(entries) ? entries : []).map(mapEntryToRow)
    const drafts = Object.values(draftRows || {})
    return [...mapped, ...drafts]
  }, [entries, draftRows])

  const filteredRows = useMemo(
    () => applyGlobalFilters(allRows, appliedFilters),
    [allRows, appliedFilters],
  )

  const groups = useMemo(() => {
    const byDept = new Map()
    LOOPC_PRODUCTION_DEPARTMENTS.forEach((d) => byDept.set(d.key, []))
    filteredRows.forEach((row) => {
      if (!row.deptKey || !byDept.has(row.deptKey)) return
      byDept.get(row.deptKey).push(row)
    })
    return LOOPC_PRODUCTION_DEPARTMENTS.map((dept) => {
      const deptFilter = deptDateFilters[dept.key] || {}
      const raw = byDept.get(dept.key) || []
      const rows = applyDeptDateFilter(raw, deptFilter.dateFrom, deptFilter.dateTo)
      return { department: dept, rows }
    })
  }, [filteredRows, deptDateFilters])

  const summary = useMemo(() => {
    const visible = groups.flatMap((g) => g.rows)
    return computeSummary(visible)
  }, [groups])

  const handleApply = () => setAppliedFilters({ ...draftFilters })
  const handleClear = () => {
    setDraftFilters({ ...EMPTY_FILTERS })
    setAppliedFilters({ ...EMPTY_FILTERS })
  }

  const toggleDept = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleDeptDateFilter = (departmentKey, next) => {
    setDeptDateFilters((prev) => ({
      ...prev,
      [departmentKey]: {
        dateFrom: next?.dateFrom || '',
        dateTo: next?.dateTo || '',
      },
    }))
  }

  const handleAddRow = (departmentKey) => {
    const draft = emptyDraftRow(departmentKey)
    setDraftRows((prev) => ({ ...prev, [draft.id]: draft }))
    setExpanded((prev) => ({ ...prev, [departmentKey]: true }))
  }

  const handleSaveRow = async (row) => {
    const departmentKey = row.deptKey
    if (!departmentKey) {
      setError('Missing department for row')
      return
    }
    const payload = rowToEntryPayload(row, departmentKey)
    setSavingId(row.id)
    setError('')
    try {
      if (row._isNew) {
        await productionControlApi.createOperationsEntry(payload)
        setDraftRows((prev) => {
          const next = { ...prev }
          delete next[row.id]
          return next
        })
      } else {
        await productionControlApi.updateOperationsEntry(row.id, payload)
      }
      await reload()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save entry')
    } finally {
      setSavingId(null)
    }
  }

  const handleDeleteRow = async (row) => {
    if (row._isNew) {
      setDraftRows((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      return
    }
    if (!window.confirm('Delete this production entry?')) return
    setSavingId(row.id)
    setError('')
    try {
      await productionControlApi.deleteOperationsEntry(row.id)
      await reload()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to delete entry')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div style={wrap}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
          Production
        </h2>
        <p style={{ margin: '0.3rem 0 0', color: '#64748B', fontSize: '0.85rem' }}>
          Department workbook — use Edit to change a row; each department has its own date filter. Source of truth for the Production Dashboard.
        </p>
      </div>

      <ProductionSummary summary={summary} />

      <ProductionFilters
        draft={draftFilters}
        onDraftChange={setDraftFilters}
        onApply={handleApply}
        onClear={handleClear}
      />

      {loading ? (
        <div style={{ color: '#64748B', fontSize: '0.875rem' }}>Loading production sheets…</div>
      ) : null}
      {error ? (
        <div style={{ color: '#B91C1C', fontSize: '0.875rem' }}>{error}</div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {groups.map(({ department, rows }) => {
          const df = deptDateFilters[department.key] || {}
          return (
            <DepartmentGroup
              key={department.key}
              department={department}
              rows={rows}
              expanded={expanded[department.key] !== false}
              onToggle={() => toggleDept(department.key)}
              editable
              savingId={savingId}
              onSaveRow={handleSaveRow}
              onDeleteRow={handleDeleteRow}
              onAddRow={() => handleAddRow(department.key)}
              dateFrom={df.dateFrom || ''}
              dateTo={df.dateTo || ''}
              onDateFilterChange={(next) => handleDeptDateFilter(department.key, next)}
            />
          )
        })}
      </div>
    </div>
  )
}
