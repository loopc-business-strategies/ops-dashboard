import { C, B, pct, Badge, ProgBar, TableWrap, TableHead, TH, TD, SH } from './ui'

export default function TabAttendance({ attendance, trainees, canEdit, isTrainee, showToast, onOpenAtt }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Attendance Tracking" sub="Session-wise attendance summary">
        {canEdit && <button style={B.pri} onClick={onOpenAtt}>📋 Mark Attendance</button>}
        {!isTrainee && <button style={B.ghost}>⬇ Export</button>}
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:750 }}>
            <thead><tr>
              {['Session','Date','Batch','Present','Absent','Late','Total','Attendance %','Status', ...(canEdit ? ['Actions'] : [])].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {attendance.map((a, i) => {
                const p = pct(a.present, a.total)
                const rowBg = p < 75 ? 'rgba(255,71,87,.04)' : p >= 90 ? 'rgba(0,200,150,.04)' : ''
                return (
                  <tr key={i} style={{ background:rowBg }}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{a.sess}</td>
                    <td style={{ ...TD, color:C.t3 }}>{a.date}</td>
                    <td style={TD}>{a.batch}</td>
                    <td style={{ ...TD, color:C.green, fontWeight:700 }}>{a.present}</td>
                    <td style={{ ...TD, color: a.absent > 0 ? C.red : C.t3, fontWeight: a.absent > 0 ? 700 : 400 }}>{a.absent}</td>
                    <td style={{ ...TD, color: a.late > 0 ? C.yellow : C.t3 }}>{a.late}</td>
                    <td style={TD}>{a.total}</td>
                    <td style={{ ...TD, minWidth:120 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <ProgBar p={p} color={p < 75 ? C.red : p >= 90 ? C.green : C.yellow} />
                        <span style={{ fontSize:12, fontWeight:700, color: p < 75 ? C.red : p >= 90 ? C.green : C.yellow, width:34, textAlign:'right' }}>{p}%</span>
                      </div>
                    </td>
                    <td style={TD}>{p < 75 ? <Badge s="Absent" /> : p >= 90 ? <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'rgba(0,200,150,.12)', color:C.green, border:'1px solid rgba(0,200,150,.3)' }}>Excellent</span> : <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'rgba(255,214,0,.1)', color:C.yellow, border:'1px solid rgba(255,214,0,.3)' }}>Acceptable</span>}</td>
                    {canEdit && <td style={TD}><button onClick={() => showToast('Tip', 'Use Mark Attendance to create corrected records')} style={{ ...B.ghost, ...B.sm }}>Amend</button></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>

      <TableWrap>
        <TableHead title="Trainee Attendance Summary" />
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Trainee','Program','Attendance %','Alert'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {trainees.map(t => (
                <tr key={t.name} style={{ background: t.att < 75 ? 'rgba(255,71,87,.04)' : '' }}>
                  <td style={TD}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(var(--purple-rgb),.2)', color:C.pur, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{t.name[0]}</div>
                      <span style={{ fontWeight:700, color:C.t1 }}>{t.name}</span>
                    </div>
                  </td>
                  <td style={{ ...TD, color:C.t3 }}>{t.prog.join(', ')}</td>
                  <td style={{ ...TD, minWidth:140 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <ProgBar p={t.att} color={t.att < 75 ? C.red : t.att >= 90 ? C.green : C.yellow} />
                      <span style={{ fontSize:12, fontWeight:700, color: t.att < 75 ? C.red : C.t1, width:34, textAlign:'right' }}>{t.att}%</span>
                    </div>
                  </td>
                  <td style={TD}>{t.att < 75 ? <Badge s="Absent" /> : <span style={{ color:C.t4 }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}

// ─── TAB: Resources ─────────────────────────────────────────────────────────────
