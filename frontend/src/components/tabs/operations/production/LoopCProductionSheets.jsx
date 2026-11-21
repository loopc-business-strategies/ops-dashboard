import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../../context/AuthContext'
import { productionControlApi } from '../../../../api/productionControl'
import { mgFloorBatchEntriesApi } from '../../../../api/mgFloorBatchEntries'
import { inventoryApi } from '../../../../api/erp-accounting/inventory'
import { LOOPC_PRODUCTION_DEPARTMENTS } from './loopcProductionDepartments'
import ProductionSummary from './ProductionSummary'
import ProductionFilters from './ProductionFilters'
import DepartmentGroup from './DepartmentGroup'
import {
  formatAlloyMetalLossLabel,
  indexAlloyMixJobsByCode,
} from '../alloyMetalLossDisplay'
import {
  EMPTY_FILTERS,
  applyDeptDateFilter,
  applyGlobalFilters,
  computeSummary,
  fetchAllOperationsEntries,
  mapEntryToRow,
} from './productionSheetUtils'

const wrap = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  width: '100%',
  minWidth: 0,
}

/**
 * Operations → Production: read-only department workbook (Floor / Gold Alloy), used by every tenant.
 * `dashboardSource`: the Production Dashboard is built from these rows (LoopC always; MG on days with rows).
 * `mgFloorSync`: MG Floor / Production Managers can re-apply approved MG Floor batches.
 * `showLossLimits`: MG — colour Loss % red above each department's limit set on the tablet.
 */
export default function LoopCProductionSheets({ dashboardSource = true, mgFloorSync = false, showLossLimits = false }) {
  const { token } = useAuth()
  const [lossLimits, setLossLimits] = useState({})
  const [alloyJobsByCode, setAlloyJobsByCode] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [syncNote, setSyncNote] = useState('')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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

  useEffect(() => {
    if (!showLossLimits) return undefined
    let mounted = true
    mgFloorBatchEntriesApi.lossLimits()
      .then((res) => { if (mounted) setLossLimits(res?.limits || {}) })
      .catch(() => { if (mounted) setLossLimits({}) })
    return () => { mounted = false }
  }, [showLossLimits])

  // MG: join BMG rows to mix jobs for Alloy Update Au/Cu loss (AML), separate from floor Loss.
  useEffect(() => {
    if (!showLossLimits || !token) {
      setAlloyJobsByCode({})
      return undefined
    }
    let mounted = true
    inventoryApi.listAlloyMixJobs(token, { includeClosed: true })
      .then((data) => {
        if (!mounted) return
        setAlloyJobsByCode(indexAlloyMixJobsByCode(data?.jobs || []))
      })
      .catch(() => { if (mounted) setAlloyJobsByCode({}) })
    return () => { mounted = false }
  }, [showLossLimits, token, entries])

  const allRows = useMemo(() => {
    const mapped = (Array.isArray(entries) ? entries : []).map((entry) => {
      const row = mapEntryToRow(entry)
      const code = String(row.alloyMixCode || row.batch || '').trim().toUpperCase()
      const job = code ? alloyJobsByCode[code] : null
      const alloyLossLabel = job ? formatAlloyMetalLossLabel(job) : null
      const jobDept = String(job?.currentDepartment || '').trim().toLowerCase()
      const jobLive = Boolean(job) && String(job.status || '') !== 'closed'
      const openVisit = row.metalOut == null || row.metalOut === ''
      // Highlight the open Ops visit in the department that currently holds the mix.
      const alloyCurrentHere = Boolean(
        row.fromGoldAlloy
        && openVisit
        && jobLive
        && jobDept
        && String(row.deptKey || '').toLowerCase() === jobDept,
      )
      return {
        ...row,
        ...(alloyLossLabel ? { alloyLossLabel } : {}),
        alloyCurrentHere,
        alloyCurrentDept: alloyCurrentHere ? jobDept : '',
      }
    })

    // Fallback when job map missing: exactly one open Gold Alloy visit per mix → mark it.
    const openByCode = new Map()
    mapped.forEach((row) => {
      if (!row.fromGoldAlloy || row.alloyCurrentHere) return
      if (!(row.metalOut == null || row.metalOut === '')) return
      const code = String(row.alloyMixCode || row.batch || '').trim().toUpperCase()
      if (!code) return
      const list = openByCode.get(code) || []
      list.push(row)
      openByCode.set(code, list)
    })
    openByCode.forEach((list) => {
      if (list.length !== 1) return
      const row = list[0]
      row.alloyCurrentHere = true
      row.alloyCurrentDept = String(row.deptKey || '').toLowerCase()
    })

    return mapped
  }, [entries, alloyJobsByCode])

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

  const handleSyncFloor = async () => {
    setSyncing(true)
    setSyncNote('')
    setError('')
    try {
      const res = await mgFloorBatchEntriesApi.syncWorkbook()
      const skipped = res?.skipped ? ` (${res.skipped} from retired departments skipped)` : ''
      setSyncNote(`${res?.linked ?? 0} approved MG Floor batches are in the workbook${skipped}.`)
      await reload()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to sync MG Floor batches')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
            Production
          </h2>
          <p style={{ margin: '0.3rem 0 0', color: '#64748B', fontSize: '0.85rem' }}>
            Department workbook — use Edit to change a row; each department has its own date filter.
            {dashboardSource ? ' Source of truth for the Production Dashboard.' : ''}
            {mgFloorSync ? ' Rows marked MG Floor come from approved tablet batches.' : ''}
          </p>
          {syncNote ? (
            <p style={{ margin: '0.3rem 0 0', color: '#166534', fontSize: '0.82rem', fontWeight: 600 }}>{syncNote}</p>
          ) : null}
        </div>
        {mgFloorSync ? (
          <button
            type="button"
            onClick={handleSyncFloor}
            disabled={syncing}
            style={{
              border: '1px solid #FDBA74',
              background: '#FFF7ED',
              color: '#9A3412',
              borderRadius: 6,
              padding: '0.4rem 0.75rem',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: syncing ? 'wait' : 'pointer',
            }}
          >
            {syncing ? 'Syncing…' : 'Sync MG Floor batches'}
          </button>
        ) : null}
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
              dateFrom={df.dateFrom || ''}
              dateTo={df.dateTo || ''}
              onDateFilterChange={(next) => handleDeptDateFilter(department.key, next)}
              lossLimitPct={lossLimits[department.key] ?? null}
            />
          )
        })}
      </div>
    </div>
  )
}
