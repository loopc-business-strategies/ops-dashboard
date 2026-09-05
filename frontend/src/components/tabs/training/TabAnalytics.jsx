import { C, B, Stars, ProgRow, Card, CardTitle, TH, TD, SH, Restrict } from './ui'

export default function TabAnalytics({ batches, canEdit: _canEdit, isAdmin, isHead, isMgmt }) {
  if (!isAdmin && !isHead && !isMgmt) return <Restrict text="Analytics & Reports are restricted to leadership roles." />

  const enroll = [{m:'Nov',v:3},{m:'Dec',v:5},{m:'Jan',v:8},{m:'Feb',v:6},{m:'Mar',v:12},{m:'Apr',v:7}]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Training Analytics & Reports" sub="Programme performance insights">
        <select style={{ background:C.inp, border:`1px solid ${C.border}`, color:C.t2, borderRadius:7, padding:'6px 12px', fontFamily:'inherit', fontSize:12, outline:'none' }}>
          <option>Last 3 Months</option><option>Last 6 Months</option><option>This Year</option>
        </select>
        <button style={B.ghost}>⬇ PDF</button>
        <button style={B.ghost}>⬇ Excel</button>
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Batch Completion Rate (%)</CardTitle>
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:110 }}>
            {batches.filter(b => b.st !== 'On Hold').map(b => (
              <div key={b.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, gap:3 }}>
                <div style={{ height:b.completion, width:'100%', borderRadius:'4px 4px 0 0', background: b.completion === 100 ? 'var(--grad-brand)' : 'linear-gradient(180deg,var(--purple),var(--purple-light))', minHeight:4 }} />
                <div style={{ fontSize:9, fontWeight:700, color:C.t3 }}>{b.completion}%</div>
                <div style={{ fontSize:9, color:C.t3 }}>{b.name.split('—')[0].trim().split(' ')[1]}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Monthly Enrollment Trend</CardTitle>
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:110 }}>
            {enroll.map(d => (
              <div key={d.m} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, gap:3 }}>
                <div style={{ height:d.v*8, width:'100%', borderRadius:'4px 4px 0 0', background:'rgba(0,180,216,.6)', minHeight:4 }} />
                <div style={{ fontSize:9, color:C.t3 }}>{d.v}</div>
                <div style={{ fontSize:9, color:C.t3 }}>{d.m}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Program Status Breakdown</CardTitle>
          {[{l:'Active Programs',v:3,c:C.green},{l:'Completed',v:2,c:C.cyan},{l:'On Hold',v:1,c:C.yellow}].map(p => (
            <ProgRow key={p.l} label={p.l} p={Math.round(p.v/6*100)} color={p.c} />
          ))}
        </Card>
        <Card>
          <CardTitle>Trainer Performance Summary</CardTitle>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Trainer','Sessions','Avg Rating','Completion %'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[{name:'James O.', sess:8, rating:4.8, comp:82},{name:'Nadia K.', sess:6, rating:4.5, comp:100},{name:'Sara A.', sess:5, rating:4.0, comp:100}].map(t => (
                <tr key={t.name}>
                  <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{t.name}</td>
                  <td style={TD}>{t.sess}</td>
                  <td style={TD}><Stars n={t.rating} size={13} /> <span style={{ color:C.gold, fontSize:12, fontWeight:700 }}>{t.rating}</span></td>
                  <td style={{ ...TD, color: t.comp === 100 ? C.cyan : C.green, fontWeight:700 }}>{t.comp}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

// ─── TAB: Trainees ──────────────────────────────────────────────────────────────
