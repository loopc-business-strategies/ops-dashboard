import { C, B, Badge, TableWrap, TH, TD, SH } from './ui'

export default function TabCerts({ certs, setCerts: _setCerts, canEdit, canApprove, isTrainee, showToast, onShowProfile, setModal, deleteCert, approveCert }) {
  const myData = isTrainee ? certs.filter(c => c.trainee === 'Ahmad Yusuf') : certs

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Certification Management" sub={isTrainee ? 'Your certificates' : 'All certifications'}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'cert', data:null })}>+ Issue Cert</button>}
        <button style={B.ghost}>⬇ Export List</button>
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth: isTrainee ? 500 : 800 }}>
            <thead><tr>
              {[...(!isTrainee ? ['Trainee'] : []), 'Certificate','Issued','Expiry','Status','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {myData.map((c, i) => {
                const rowBg = c.st === 'Expired' ? 'rgba(255,71,87,.04)' : c.st === 'Pending' ? 'rgba(255,214,0,.03)' : ''
                return (
                  <tr key={i} style={{ background:rowBg }}>
                    {!isTrainee && <td style={TD}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(0,200,150,.2)', color:C.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{c.trainee[0]}</div>
                        <button onClick={() => onShowProfile(c.trainee)} style={{ background:'none', border:'none', cursor:'pointer', color:C.pur, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>{c.trainee}</button>
                      </div>
                    </td>}
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{c.cert}</td>
                    <td style={{ ...TD, color: c.issued === '—' ? C.t4 : C.t3 }}>{c.issued}</td>
                    <td style={{ ...TD, color: c.st === 'Expired' ? C.red : c.expiry === '—' ? C.t4 : C.t3 }}>{c.expiry}{c.st === 'Expired' ? ' ⚠' : ''}</td>
                    <td style={TD}><Badge s={c.st} /></td>
                    <td style={TD}>
                      {c.doc !== '—' && <button onClick={() => showToast('Download', `${c.cert} certificate downloaded`)} style={{ background:'none', border:'none', cursor:'pointer', color:C.pur, fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>⬇ Download</button>}
                      {canApprove && c.st === 'Pending' && <button onClick={() => {
                        approveCert(c.trainee)
                        showToast('Certificate Approved', `${c.trainee} certificate issued`)
                      }} style={{ background:'none', border:'none', cursor:'pointer', color:C.green, fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Approve</button>}
                      {canEdit && <button onClick={() => setModal({ type:'cert', data:c })} style={{ ...B.ghost, ...B.sm, marginRight:6 }}>Edit</button>}
                      {canEdit && <button onClick={() => { if (window.confirm('Delete this certificate row?')) { deleteCert(c.id); showToast('Deleted', 'Certificate record removed') } }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>Del</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}

// ─── TAB: Feedback ──────────────────────────────────────────────────────────────
