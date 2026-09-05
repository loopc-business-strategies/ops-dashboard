import { C, B, pct, avg, Badge, ProgBar, StatCard, TableWrap, TH, TD, SH } from './ui'

export default function TabAssessments({ assessments, setAssessments: _setAssessments, canEdit, isTrainee, showToast, onOpenAdd, onShowProfile, setModal, deleteAssessment }) {
  const myData = isTrainee ? assessments.filter(a => a.trainee === 'Ahmad Yusuf') : assessments
  const pass = assessments.filter(a => a.pass).length
  const passRate = pct(pass, assessments.length)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Assessments & Scores" sub={isTrainee ? 'Your results only' : 'All assessment results'}>
        {canEdit && <button style={B.pri} onClick={onOpenAdd}>+ Add Result</button>}
      </SH>

      {!isTrainee && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11 }}>
          <StatCard label="Total Assessments" value={<span style={{color:C.cyan}}>{assessments.length}</span>} sub="Recorded" dot={C.cyan} />
          <StatCard label="Pass Rate" value={<span style={{color:C.green}}>{passRate}%</span>} bottom={<ProgBar p={passRate} color={C.green} height={6} />} />
          <StatCard label="Avg Score" value={<span style={{color:C.pur}}>{avg(assessments,'score')}%</span>} sub="All attempts" dot={C.pur} />
        </div>
      )}

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth: isTrainee ? 500 : 700 }}>
            <thead><tr>
              {[...(!isTrainee ? ['Trainee'] : []), 'Program','Score','Result','Date','Attempt', ...(!isTrainee && canEdit ? ['Actions'] : [])].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {myData.map((a, i) => (
                <tr key={i} style={{ background: a.pass ? 'rgba(0,200,150,.04)' : 'rgba(255,71,87,.04)' }}>
                  {!isTrainee && <td style={TD}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(var(--purple-rgb),.2)', color:C.pur, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{a.trainee[0]}</div>
                      <button onClick={() => onShowProfile(a.trainee)} style={{ background:'none', border:'none', cursor:'pointer', color:C.pur, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>{a.trainee}</button>
                    </div>
                  </td>}
                  <td style={TD}>{a.prog}</td>
                  <td style={{ ...TD, minWidth:120 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <ProgBar p={a.score} color={a.score >= 75 ? C.green : C.red} />
                      <span style={{ fontSize:12, fontWeight:800, color: a.score >= 75 ? C.green : C.red, width:36, textAlign:'right' }}>{a.score}%</span>
                    </div>
                  </td>
                  <td style={TD}><Badge s={a.pass ? 'Pass' : 'Fail'} /></td>
                  <td style={{ ...TD, color:C.t3 }}>{a.date}</td>
                  <td style={{ ...TD, color: a.attempt > 1 ? C.yellow : C.t3 }}>#{a.attempt}{a.attempt > 1 ? ' (Retest)' : ''}</td>
                  {!isTrainee && canEdit && <td style={TD}>
                    <button onClick={() => setModal({ type:'assess', data:a })} style={{ ...B.sec, ...B.sm, marginRight:6 }}>Edit</button>
                    <button onClick={() => { if (window.confirm('Delete this result?')) { deleteAssessment(a.id); showToast('Deleted', 'Assessment removed') } }} style={{ background:'none', border:'none', color:C.red, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Del</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}

// ─── TAB: Certifications ────────────────────────────────────────────────────────
