import { C, B, ProgBar, TableWrap, TH, TD, SH } from './ui'

export default function TabTrainees({ trainees, setTrainees: _setTrainees, canEdit, isTrainee, showToast, onShowProfile, setModal, deleteTrainee }) {
  const showData = isTrainee ? trainees.filter(t => t.name === 'Ahmad Yusuf') : trainees

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Trainee Profiles" sub={isTrainee ? 'Your profile' : `All ${trainees.length} trainees`}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'trainee', data:null })}>+ Enroll Trainee</button>}
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:750 }}>
            <thead><tr>
              {['Trainee','Department','Role','Programs','Attendance','Certs','Profile', ...(canEdit && !isTrainee ? ['Actions'] : [])].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {showData.map(t => (
                <tr key={t.name}>
                  <td style={TD}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(var(--purple-rgb),.2)', color:C.pur, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{t.name[0]}</div>
                      <div>
                        <div style={{ fontWeight:700, color:C.t1 }}>{t.name}</div>
                        <div style={{ fontSize:10, color:C.t3 }}>{t.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={TD}>{t.dept}</td>
                  <td style={{ ...TD, color:C.t3 }}>{t.role}</td>
                  <td style={TD}>{t.prog.map(p => <span key={p} style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'rgba(var(--purple-rgb),.15)', color:C.pur, border:'1px solid rgba(var(--purple-rgb),.3)', marginRight:3, whiteSpace:'nowrap' }}>{p.split(' ').slice(0,2).join(' ')}</span>)}</td>
                  <td style={{ ...TD, minWidth:130 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <ProgBar p={t.att} color={t.att < 75 ? C.red : t.att >= 90 ? C.green : C.yellow} />
                      <span style={{ fontSize:11, fontWeight:700, color: t.att < 75 ? C.red : C.t1, width:34, textAlign:'right' }}>{t.att}%</span>
                    </div>
                  </td>
                  <td style={TD}><span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background: t.certs > 0 ? 'rgba(0,200,150,.12)':'rgba(255,255,255,.05)', color: t.certs > 0 ? C.green : C.t3, border:`1px solid ${t.certs > 0 ? 'rgba(0,200,150,.3)':'rgba(255,255,255,.1)'}` }}>{t.certs} cert{t.certs !== 1 ? 's' : ''}</span></td>
                  <td style={TD}><button onClick={() => onShowProfile(t.name)} style={{ ...B.sec, ...B.sm }}>View Profile</button></td>
                  {canEdit && !isTrainee && <td style={TD}>
                    <button onClick={() => setModal({ type:'trainee', data:t })} style={{ ...B.sec, ...B.sm, marginRight:6 }}>Edit</button>
                    <button onClick={() => { if (window.confirm(`Delete ${t.name}?`)) { deleteTrainee(t.id); showToast('Deleted', 'Trainee removed') } }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>Del</button>
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

// ─── TAB: Skill Gap ─────────────────────────────────────────────────────────────
