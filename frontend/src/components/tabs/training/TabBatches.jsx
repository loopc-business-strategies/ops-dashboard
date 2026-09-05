import { C, B, Badge, ProgBar, SH } from './ui'

export default function TabBatches({ batches, setBatches: _setBatches, canEdit, isTrainee, showToast, setModal, deleteBatch }) {
  const showData = isTrainee ? batches.filter(b => b.name.includes('Batch A')) : batches

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Batch Management" sub={`${showData.length} batches${isTrainee ? ' — your enrollment' : ''}`}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'batch', data:null })}>+ Create Batch</button>}
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12 }}>
        {showData.map(b => {
          const topColor = b.st === 'Active' ? C.green : b.st === 'On Hold' ? C.yellow : C.cyan
          const barColor = b.completion === 100 ? C.green : b.st === 'On Hold' ? C.yellow : C.gbar
          return (
            <div key={b.id} onClick={() => showToast('Batch Detail', `${b.name} — ${b.trainees} trainees enrolled`)}
              style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:16, cursor:'pointer', position:'relative', overflow:'hidden', transition:'all .15s' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:topColor }} />
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.t1 }}>{b.name}</div>
                <Badge s={b.st} />
              </div>
              <div style={{ fontSize:11, color:C.t3, marginBottom:3 }}>📚 {b.prog}</div>
              <div style={{ fontSize:11, color:C.t3, marginBottom:3 }}>🧑‍🏫 Trainer: {b.trainer}</div>
              <div style={{ fontSize:11, color:C.t3, marginBottom:3 }}>📅 {b.start} — {b.end}</div>
              <div style={{ fontSize:11, color:C.t3, marginBottom:10 }}>👥 {b.trainees} trainees</div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.t3, marginBottom:4 }}>
                <span>Completion</span>
                <span style={{ fontWeight:700, color: b.completion === 100 ? C.green : C.t1 }}>{b.completion}%</span>
              </div>
              <ProgBar p={b.completion} color={barColor} height={6} />
              {canEdit && (
                <div style={{ marginTop:10, display:'flex', gap:6 }}>
                  <button onClick={e => { e.stopPropagation(); setModal({ type:'batch', data:b }) }} style={{ ...B.sec, ...B.sm }}>Edit</button>
                  <button onClick={e => { e.stopPropagation(); showToast('Trainees', `View all ${b.trainees} trainees in ${b.name}`) }} style={{ ...B.ghost, ...B.sm }}>View Trainees</button>
                  <button onClick={e => { e.stopPropagation(); if (window.confirm('Delete this batch?')) { deleteBatch(b.id); showToast('Deleted', 'Batch removed') } }} style={{ background:'none', border:'none', color:C.red, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Del</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── TAB: Attendance ────────────────────────────────────────────────────────────
