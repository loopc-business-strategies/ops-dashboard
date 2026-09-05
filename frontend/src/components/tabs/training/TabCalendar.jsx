import { C, B, Badge, TableWrap, TableHead, TH, TD, SH } from './ui'

export default function TabCalendar({ sessions, setSessions: _setSessions, canEdit, isTrainee, showToast, onShowSession, setModal, deleteSession }) {
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const myBatch = 'Batch A'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Training Calendar" sub={`April 2026 — ${isTrainee ? 'Your sessions only' : 'All scheduled sessions'}`}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'session', data:null })}>+ Add Session</button>}
      </SH>

      <div style={{ display:'flex', gap:12, marginBottom:4, fontSize:11 }}>
        {[['rgba(0,180,216,.4)','Scheduled'],['rgba(0,200,150,.4)','Completed'],['rgba(255,71,87,.4)','Cancelled']].map(([bg,lbl]) => (
          <span key={lbl} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:10, height:10, borderRadius:2, background:bg, display:'inline-block' }} />
            {lbl}
          </span>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
        {DAYS.map(d => <div key={d} style={{ fontSize:10, fontWeight:700, color:C.t3, textAlign:'center', padding:'4px 0', textTransform:'uppercase' }}>{d}</div>)}
        {/* April 2026 starts on Wednesday (offset 2) */}
        {[null, null, ...Array.from({ length:30 }, (_, i) => i + 1)].map((d, idx) => {
          if (!d) return <div key={idx} />
          const today = d === 13
          const daySessions = sessions.filter(s => s.day === d && (!isTrainee || s.batch === myBatch))
          return (
            <div key={d}
              onClick={() => daySessions.length ? onShowSession(daySessions[0]) : showToast(`April ${d}`, 'No sessions scheduled')}
              style={{ minHeight:70, background: today ? 'rgba(var(--purple-rgb),.08)' : 'rgba(255,255,255,.03)', border:`1px solid ${today ? 'var(--purple)' : 'rgba(255,255,255,.05)'}`, borderRadius:6, padding:5, cursor:'pointer', transition:'all .15s' }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.t2, marginBottom:3 }}>{d}</div>
              {daySessions.map(s => (
                <div key={s.id}
                  onClick={e => { e.stopPropagation(); onShowSession(s) }}
                  style={{ fontSize:9, fontWeight:600, padding:'2px 5px', borderRadius:3, marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', background: s.st==='Completed'?'rgba(0,200,150,.2)':s.st==='Cancelled'?'rgba(255,71,87,.2)':'rgba(0,180,216,.2)', color: s.st==='Completed'?C.green:s.st==='Cancelled'?C.red:C.cyan }}>
                  {s.time} {s.title.split('—')[0].trim()}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {canEdit && !isTrainee && (
        <TableWrap>
          <TableHead title="Session List" subtitle="Quick manage sessions" />
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:780 }}>
              <thead><tr>{['Title','Date','Time','Trainer','Batch','Status','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{s.title}</td>
                    <td style={{ ...TD, color:C.t3 }}>{s.date}</td>
                    <td style={TD}>{s.time}</td>
                    <td style={TD}>{s.trainer}</td>
                    <td style={TD}>{s.batch}</td>
                    <td style={TD}><Badge s={s.st} /></td>
                    <td style={TD}>
                      <button onClick={() => setModal({ type:'session', data:s })} style={{ ...B.sec, ...B.sm, marginRight:6 }}>Edit</button>
                      <button onClick={() => { if (window.confirm('Delete this session?')) { deleteSession(s.id); showToast('Deleted', 'Session removed') } }} style={{ background:'none', border:'none', color:C.red, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableWrap>
      )}
    </div>
  )
}

// ─── TAB: Batches ───────────────────────────────────────────────────────────────
