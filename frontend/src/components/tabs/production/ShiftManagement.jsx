import { useState } from 'react'
import {
  USE_SEED_DATA, SectionHeader, linesForUi, SHIFTS, DAYS, DEFAULT_SHIFT_GRID,
} from './shared'

// ── Shift Management ──────────────────────────────
function ShiftManagement({ canEdit, showToast }) {
  const [grid, setGrid] = useState(USE_SEED_DATA ? DEFAULT_SHIFT_GRID : {})

  const shiftColor = s => s === 0 ? 'bg-blue-500/20 text-blue-400' : s === 1 ? 'bg-green-500/20 text-green-400' : s === 2 ? 'bg-violet-500/20 text-violet-400' : 'bg-gray-800/50 text-gray-600'
  const shiftLabel = s => s === null ? 'Off' : SHIFTS[s].split(' ')[0]
  const cycleShift = (lineId, day) => {
    if (!canEdit) return
    setGrid(p => {
      const cur = p[lineId]?.[day]
      const next = cur === null ? 0 : cur === 0 ? 1 : cur === 1 ? 2 : null
      return { ...p, [lineId]: { ...p[lineId], [day]: next } }
    })
  }

  const autoBalance = () => {
    if (!canEdit) return
    const rows = {}
    linesForUi.forEach((line, li) => {
      rows[line.id] = {}
      DAYS.forEach((d, di) => {
        rows[line.id][d] = di === 6 ? null : (li + di) % 3
      })
    })
    setGrid(rows)
    showToast('Shifts Rebalanced', 'Weekly assignments auto-balanced.')
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Shift Management" sub="Weekly schedule — 3 shifts per line" />

      {canEdit && (
        <div className="flex gap-2">
          <button onClick={autoBalance} className="px-3 py-1.5 text-xs rounded-md border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">Auto-balance Week</button>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 pr-4 w-40">Line</th>
              {DAYS.map(d => (
                <th key={d} className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider pb-3 px-2">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {linesForUi.map(line => (
              <tr key={line.id}>
                <td className="py-3 pr-4">
                  <p className="text-xs font-medium text-white">{line.id}</p>
                  <p className="text-xs text-gray-500">{line.operator}</p>
                </td>
                {DAYS.map(d => {
                  const s = grid[line.id]?.[d]
                  return (
                    <td key={d} className="py-3 px-2 text-center">
                      <button
                        onClick={() => cycleShift(line.id, d)}
                        className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${shiftColor(s)} ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}>
                        {shiftLabel(s)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4">
        {[['blue', 'Morning (06–14)'], ['green', 'Afternoon (14–22)'], ['violet', 'Night (22–06)'], ['gray', 'Off / No Shift']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-2 text-xs text-gray-400">
            <span className={`w-3 h-3 rounded bg-${c}-500/30 inline-block`} />{l}
          </span>
        ))}
      </div>

      {/* Shift Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SHIFTS.map((shift, i) => {
          const count = Object.values(grid).reduce((s, days) => s + Object.values(days).filter(v => v === i).length, 0)
          const colors = ['text-blue-400', 'text-green-400', 'text-violet-400']
          return (
            <div key={shift} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500">{shift}</p>
              <p className={`text-2xl font-bold mt-1 ${colors[i]}`}>{count}</p>
              <p className="text-xs text-gray-600 mt-0.5">scheduled assignments this week</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ShiftManagement
