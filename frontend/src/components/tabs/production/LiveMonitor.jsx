import { useState } from 'react'
import { C, Badge, OEEGauge, SectionHeader, Modal, linesForUi, STATE_COLORS } from './shared'

// ── Live Monitor ──────────────────────────────────
function LiveMonitor({ canEdit: _canEdit, showToast: _showToast }) {
  const [selected, setSelected] = useState(null)

  return (
    <div className="space-y-5">
      <SectionHeader title="Live Production Monitor" sub="Real-time status across all production lines" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {linesForUi.map(line => {
          const sc = STATE_COLORS[line.state]
          const pct = Math.round((line.output / line.target) * 100)
          return (
            <div key={line.id}
                 className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-violet-500/30 transition-all cursor-pointer"
                 onClick={() => setSelected(line)}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{line.name}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">Operator: {line.operator}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge color={sc.badge}>{sc.label}</Badge>
                  <span className="text-xs text-gray-500">Click for details</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <OEEGauge value={line.oee} size={72} />
                <div className="flex-1 grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <p className="text-gray-500">Output Today</p>
                    <p className="text-white font-semibold">{line.output.toLocaleString()} pcs</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Target</p>
                    <p className="text-white font-semibold">{line.target.toLocaleString()} pcs</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Quality</p>
                    <p className="text-green-400 font-semibold">{line.quality}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Speed</p>
                    <p className="text-white font-semibold">{line.speed > 0 ? `${line.speed}%` : '—'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                       style={{ width: `${Math.min(100, pct)}%`, background: pct >= 90 ? '#22c55e' : pct >= 70 ? '#eab308' : '#ef4444' }} />
                </div>
                <span className="text-xs text-gray-500">{pct}%</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white mb-4 leading-tight">Today's Production Timeline</h4>
        <div className="space-y-3">
          {linesForUi.map(line => (
            <div key={line.id} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-32 shrink-0 truncate">{line.id}</span>
              <div className="flex-1 h-6 bg-gray-800 rounded-md overflow-hidden flex">
                {line.state === 'running' && <>
                  <div className="h-full bg-green-600/70" style={{ width: '72%' }} title="Running" />
                  <div className="h-full bg-gray-700/50" style={{ width: '28%' }} title="Idle" />
                </>}
                {line.state === 'maintenance' && <>
                  <div className="h-full bg-green-600/70" style={{ width: '38%' }} title="Running" />
                  <div className="h-full bg-yellow-500/60" style={{ width: '30%' }} title="Maintenance" />
                  <div className="h-full bg-gray-700/50" style={{ width: '32%' }} title="Idle" />
                </>}
                {line.state === 'idle' && <>
                  <div className="h-full bg-green-600/70" style={{ width: '55%' }} title="Running" />
                  <div className="h-full bg-gray-700/50" style={{ width: '45%' }} title="Idle" />
                </>}
              </div>
              <div className="flex gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-600/70 inline-block" />Run</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500/60 inline-block" />Maint</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-700/80 inline-block" />Idle</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Line Detail Modal */}
      <Modal open={!!selected} title={selected ? `${selected.name} — Details` : ''} onClose={() => setSelected(null)} wide>
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Current State</p>
                <Badge color={STATE_COLORS[selected.state].badge}>{STATE_COLORS[selected.state].label}</Badge>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-4">
                <OEEGauge value={selected.oee} size={60} />
                <div>
                  <p className="text-xs text-gray-500">OEE Score</p>
                  <p className="text-xl font-bold text-white">{selected.oee}%</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ['Output Today', `${selected.output.toLocaleString()} pcs`],
                ['Target', `${selected.target.toLocaleString()} pcs`],
                ['Quality', `${selected.quality}%`],
                ['Speed', `${selected.speed || 0}%`],
                ['Temperature', `${selected.temp}°C`],
                ['Operator', selected.operator],
              ].map(([k, v]) => (
                <div key={k} className="bg-gray-900 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{k}</p>
                  <p className="text-sm font-semibold text-white mt-1">{v}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">7-Day Performance Trend</p>
              <div className="flex items-end gap-2 h-20">
                {[72, 81, 78, 85, 82, 79, selected.oee].map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm transition-all"
                         style={{ height: `${(v / 100) * 72}px`, background: i === 6 ? C.acc : '#374151' }} />
                    <span className="text-xs text-gray-600">{['M','T','W','T','F','S','T'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default LiveMonitor
