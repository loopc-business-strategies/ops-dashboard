import { useMemo, useState } from 'react'
import { useVirtualTableRows } from '../../../../hooks/useVirtualTableRows'
import {
  SHEET_COLUMNS,
  applyColumnFilters,
  sortRows,
  uniqueOptions,
} from './productionSheetUtils'

const TABLE_VIEWPORT_H = 360
const FILTER_ROW_H = 32

const pane = {
  border: '1px solid #94A3B8',
  borderRadius: '0 0 0.375rem 0.375rem',
  background: '#FFFFFF',
  overflow: 'hidden',
}

const scrollBox = {
  maxHeight: TABLE_VIEWPORT_H,
  overflowY: 'auto',
  overflowX: 'auto',
}

const table = {
  width: '100%',
  minWidth: 1480,
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: '0.88rem',
  color: '#0F172A',
}

const filterTh = {
  position: 'sticky',
  top: 0,
  zIndex: 3,
  background: '#F1F5F9',
  borderBottom: '1px solid #94A3B8',
  borderRight: '1px solid #CBD5E1',
  padding: '0.25rem 0.35rem',
}

const thBase = {
  position: 'sticky',
  top: FILTER_ROW_H,
  zIndex: 2,
  background: '#E2E8F0',
  borderBottom: '1px solid #94A3B8',
  borderRight: '1px solid #CBD5E1',
  padding: '0.45rem 0.55rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  textAlign: 'left',
  userSelect: 'none',
}

const tdBase = {
  borderBottom: '1px solid #E2E8F0',
  borderRight: '1px solid #E2E8F0',
  padding: '0.4rem 0.55rem',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
}

const filterInput = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #CBD5E1',
  borderRadius: '0.25rem',
  padding: '0.2rem 0.35rem',
  fontSize: '0.75rem',
  background: '#FFFFFF',
}

function cellDisplay(row, key) {
  if (key === 'metalIn') return row.metalInDisplay
  if (key === 'metalOut') return row.metalOutDisplay
  if (key === 'metalLoss') return row.metalLossDisplay
  if (key === 'timeBatch') return row.timeBatchDisplay
  return row[key] ?? '—'
}

/**
 * Excel-style department table with sticky headers and independent scroll.
 * Column filters sit above the sortable heading row.
 */
export default function DepartmentTable({ rows }) {
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [columnFilters, setColumnFilters] = useState({})

  const filtered = useMemo(
    () => applyColumnFilters(rows || [], columnFilters),
    [rows, columnFilters],
  )
  const sorted = useMemo(
    () => sortRows(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  )

  const { scrollRef, enabled, virtualItems, paddingTop, paddingBottom } = useVirtualTableRows(
    sorted.length,
    { estimateSize: 38, threshold: 60, overscan: 10 },
  )

  const employeeOpts = useMemo(() => uniqueOptions(rows || [], 'employee'), [rows])
  const managerOpts = useMemo(() => uniqueOptions(rows || [], 'departmentManager'), [rows])

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'employee' || key === 'batch' || key === 'departmentManager' ? 'asc' : 'desc')
    }
  }

  const setColFilter = (key, value) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }))
  }

  const renderFilterCell = (col) => {
    if (col.filter === 'select' && col.key === 'employee') {
      return (
        <select
          style={filterInput}
          value={columnFilters.employee || ''}
          onChange={(e) => setColFilter('employee', e.target.value)}
        >
          <option value="">All</option>
          {employeeOpts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    if (col.filter === 'select' && col.key === 'departmentManager') {
      return (
        <select
          style={filterInput}
          value={columnFilters.departmentManager || ''}
          onChange={(e) => setColFilter('departmentManager', e.target.value)}
        >
          <option value="">All</option>
          {managerOpts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    if (col.filter === 'search') {
      return (
        <input
          style={filterInput}
          value={columnFilters[col.key] || ''}
          onChange={(e) => setColFilter(col.key, e.target.value)}
          placeholder="Filter…"
        />
      )
    }
    if (col.filter === 'date') {
      return (
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            type="date"
            style={filterInput}
            value={columnFilters.dateFrom || ''}
            onChange={(e) => setColFilter('dateFrom', e.target.value)}
            title="From"
          />
          <input
            type="date"
            style={filterInput}
            value={columnFilters.dateTo || ''}
            onChange={(e) => setColFilter('dateTo', e.target.value)}
            title="To"
          />
        </div>
      )
    }
    return <span style={{ display: 'block', height: 22 }} />
  }

  const renderRow = (row, idx) => (
    <tr
      key={row.id || idx}
      style={{ background: idx % 2 ? '#F8FAFC' : '#FFFFFF' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#ECFDF5' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 ? '#F8FAFC' : '#FFFFFF' }}
    >
      {SHEET_COLUMNS.map((col) => (
        <td
          key={col.key}
          style={{
            ...tdBase,
            textAlign: col.align || 'left',
            fontWeight: 500,
            fontVariantNumeric: col.numeric ? 'tabular-nums' : undefined,
          }}
        >
          {cellDisplay(row, col.key)}
        </td>
      ))}
    </tr>
  )

  return (
    <div style={pane}>
      <div ref={scrollRef} style={scrollBox}>
        <table style={table}>
          <thead>
            <tr>
              {SHEET_COLUMNS.map((col) => (
                <th key={`f-${col.key}`} style={filterTh}>
                  {renderFilterCell(col)}
                </th>
              ))}
            </tr>
            <tr>
              {SHEET_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  style={{ ...thBase, textAlign: col.align || 'left', cursor: col.sortable ? 'pointer' : 'default' }}
                  onClick={() => col.sortable && toggleSort(col.key)}
                >
                  {col.label}
                  {col.sortable ? (
                    <span style={{ marginLeft: 4, opacity: sortKey === col.key ? 1 : 0.35, fontSize: '0.7rem' }}>
                      {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr>
                <td style={tdBase} colSpan={SHEET_COLUMNS.length}>
                  No production rows for this department.
                </td>
              </tr>
            ) : enabled && virtualItems ? (
              <>
                {paddingTop > 0 ? (
                  <tr><td colSpan={SHEET_COLUMNS.length} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
                ) : null}
                {virtualItems.map((v) => renderRow(sorted[v.index], v.index))}
                {paddingBottom > 0 ? (
                  <tr><td colSpan={SHEET_COLUMNS.length} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr>
                ) : null}
              </>
            ) : (
              sorted.map((row, idx) => renderRow(row, idx))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
