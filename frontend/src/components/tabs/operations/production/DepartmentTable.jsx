import { useMemo, useState } from 'react'
import { useVirtualTableRows } from '../../../../hooks/useVirtualTableRows'
import {
  SHEET_COLUMNS,
  sortRows,
} from './productionSheetUtils'

const TABLE_VIEWPORT_H = 360

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

const thBase = {
  position: 'sticky',
  top: 0,
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

function cellDisplay(row, key) {
  if (key === 'metalIn') return row.metalInDisplay
  if (key === 'metalOut') return row.metalOutDisplay
  if (key === 'metalLoss') return row.metalLossDisplay
  if (key === 'timeBatch') return row.timeBatchDisplay
  return row[key] ?? '—'
}

/**
 * Excel-style department table with sticky headers and independent scroll.
 */
export default function DepartmentTable({ rows }) {
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  const sorted = useMemo(
    () => sortRows(rows || [], sortKey, sortDir),
    [rows, sortKey, sortDir],
  )

  const { scrollRef, enabled, virtualItems, paddingTop, paddingBottom } = useVirtualTableRows(
    sorted.length,
    { estimateSize: 38, threshold: 60, overscan: 10 },
  )

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'employee' || key === 'batch' || key === 'departmentManager' ? 'asc' : 'desc')
    }
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
