import { C, B, ProgBar, ProgRow, StatCard, Card, CardTitle, SH } from './ui'

export default function TabKPI({ batches, certs, sessions }) {
  const activeProgs = batches.filter(b => b.st === 'Active').length
  const avgComp = Math.round(batches.reduce((a, b) => a + b.completion, 0) / batches.length)
  const certsIssued = certs.filter(c => c.st === 'Issued').length
  const sessWeek = sessions.filter(s => s.day >= 13 && s.day <= 19 && s.st === 'Scheduled').length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Training Overview" sub="Programme-wide metrics — April 2026">
        <button style={B.ghost}>⬇ Export Report</button>
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Total Trainees" value={<span style={{color:C.cyan}}>7</span>} sub="Across all programs" dot={C.cyan} />
        <StatCard label="Active Programs" value={<span style={{color:C.green}}>{activeProgs}</span>} sub={`of ${batches.length} batches`} dot={C.green} />
        <StatCard label="Avg Completion" value={<span style={{color:C.pur}}>{avgComp}%</span>}
          bottom={<ProgBar p={avgComp} color={C.grad} height={6} />} />
        <StatCard label="Certs Issued" value={<span style={{color:C.green}}>{certsIssued}</span>} sub="This month" dot={C.green} />
        <StatCard label="Overdue Tasks" value={<span style={{color:C.red}}>2</span>} sub="Needs attention" dot={C.red} />
        <StatCard label="Sessions This Week" value={<span style={{color:C.yellow}}>{sessWeek}</span>} sub="Apr 13–19" dot={C.yellow} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Batch Completion Progress</CardTitle>
          {batches.map(b => (
            <ProgRow key={b.id} label={b.name.split('—')[0].trim()} p={b.completion}
              color={b.completion === 100 ? 'var(--grad-bar)' : b.st === 'On Hold' ? C.yellow : C.gbar} />
          ))}
        </Card>
        <Card>
          <CardTitle>Recent Activity</CardTitle>
          {[
            { ic:'✅', t:'Batch C Compliance completed',         s:'All 15 trainees certified',                col:C.green },
            { ic:'📝', t:'3 assessments scored today',           s:'2 passed, 1 failed — retest pending',      col:C.yellow },
            { ic:'🏆', t:'4 new certificates issued',            s:'Gold Safety Level 1 — Apr 14',             col:C.pur },
            { ic:'⚠️', t:'Low attendance: Hassan Ali 58%',       s:'Below 75% threshold — action needed',      col:C.red },
          ].map((a, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontSize:18, flexShrink:0 }}>{a.ic}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:a.col }}>{a.t}</div>
                <div style={{ fontSize:11, color:C.t3, marginTop:2 }}>{a.s}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ─── TAB: Calendar ──────────────────────────────────────────────────────────────
