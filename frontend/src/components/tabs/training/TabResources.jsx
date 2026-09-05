import { C, B, Badge, TableWrap, TH, TD, SH } from './ui'

export default function TabResources({ resources, setResources: _setResources, canEdit, isTrainee, showToast, setModal, deleteResource }) {
  const showData = isTrainee ? resources.filter(r => r.prog === 'Gold Safety Essentials') : resources

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Resource Library" sub={isTrainee ? 'Your program materials only' : 'All training materials'}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'resource', data:null })}>⬆ Upload Material</button>}
      </SH>

      <select style={{ background:C.inp, border:`1px solid ${C.border}`, color:C.t2, borderRadius:7, padding:'7px 14px', fontFamily:'inherit', fontSize:12, outline:'none', alignSelf:'flex-start' }}>
        <option>All Programs</option>
        {['Gold Safety Essentials','Equipment Operation','Compliance & Legal','Leadership Development','Tech Skills'].map(o => <option key={o}>{o}</option>)}
      </select>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:750 }}>
            <thead><tr>
              {['File Name','Program','Type','Uploaded By','Date','Views','Action'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {showData.map(r => {
                const icon = r.type === 'PDF' ? '📄' : r.type === 'Video' ? '🎬' : '📊'
                return (
                  <tr key={r.id}>
                    <td style={TD}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:18 }}>{icon}</span>
                        <span style={{ fontWeight:700, color:C.t1 }}>{r.name}</span>
                      </div>
                    </td>
                    <td style={{ ...TD, color:C.t3 }}>{r.prog}</td>
                    <td style={TD}><Badge s={r.type} /></td>
                    <td style={{ ...TD, color:C.t2 }}>{r.by}</td>
                    <td style={{ ...TD, color:C.t3 }}>{r.date}</td>
                    <td style={{ ...TD, color:C.t3 }}>{r.views} views</td>
                    <td style={TD}>
                      <button onClick={() => showToast('Download', `${r.name} downloaded`)} style={{ ...B.sec, ...B.sm }}>⬇ Download</button>
                      {canEdit && <button onClick={() => setModal({ type:'resource', data:r })} style={{ ...B.ghost, ...B.sm, marginLeft:6 }}>Edit</button>}
                      {canEdit && <button onClick={() => { deleteResource(r.id); showToast('Deleted', 'File removed') }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit', marginLeft:8 }}>Del</button>}
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

// ─── TAB: Assessments ───────────────────────────────────────────────────────────
