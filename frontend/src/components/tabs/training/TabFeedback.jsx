import { C, B, Stars, ProgRow, Card, CardTitle, TableWrap, TableHead, TH, TD, SH } from './ui'

export default function TabFeedback({ feedback, setFeedback: _setFeedback, canEdit: _canEdit, isTrainee, isTrainer, showToast: _showToast, onOpenFeedback }) {
  if (isTrainee) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
        <SH title="Session Feedback" sub="Submit feedback after each completed session">
          <button style={B.pri} onClick={onOpenFeedback}>⭐ Submit Feedback</button>
        </SH>
        <div style={{ background:'rgba(var(--purple-rgb),.08)', border:`1px solid ${C.border}`, borderRadius:10, padding:'14px 18px', fontSize:13, color:C.t2 }}>
          You can submit feedback after each completed session. Click <strong style={{ color:C.pur }}>Submit Feedback</strong> above.
        </div>
      </div>
    )
  }

  const trainers = [...new Set(feedback.map(f => f.trainer))]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Trainer Feedback & Ratings" sub={isTrainer ? 'Your feedback summary' : 'All trainer ratings'} />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:14 }}>
        {trainers.filter(tr => !isTrainer || tr === 'James O.').map(tr => {
          const tf = feedback.filter(f => f.trainer === tr)
          const avgT = (tf.reduce((a,b) => a + b.trainerRating, 0) / tf.length).toFixed(1)
          const avgC = (tf.reduce((a,b) => a + b.contentRating,  0) / tf.length).toFixed(1)
          return (
            <Card key={tr}>
              <CardTitle>{tr}</CardTitle>
              <div style={{ textAlign:'center', marginBottom:12 }}>
                <div style={{ fontSize:32, fontWeight:800, color:C.gold }}>{avgT}</div>
                <div style={{ margin:'4px 0' }}><Stars n={parseFloat(avgT)} size={16} /></div>
                <div style={{ fontSize:11, color:C.t3 }}>{tf.length} feedback submissions</div>
              </div>
              <ProgRow label="Trainer Rating" p={Math.round(parseFloat(avgT)/5*100)} color={C.gold} />
              <ProgRow label="Content Rating" p={Math.round(parseFloat(avgC)/5*100)} color={C.pur} />
            </Card>
          )
        })}
      </div>

      {!isTrainer && (
        <TableWrap>
          <TableHead title="All Feedback Comments" />
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
              <thead><tr>
                {['Trainer','Trainee','Session','Trainer ★','Content ★','Venue ★','Comment'].map(h => <th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {feedback.map((f, i) => (
                  <tr key={i}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{f.trainer}</td>
                    <td style={TD}>{f.trainee}</td>
                    <td style={{ ...TD, color:C.t3, fontSize:11 }}>{f.session}</td>
                    <td style={TD}><Stars n={f.trainerRating} size={13} /></td>
                    <td style={TD}><Stars n={f.contentRating} size={13} /></td>
                    <td style={TD}><Stars n={f.venueRating}   size={13} /></td>
                    <td style={{ ...TD, color:C.t3, fontSize:11, maxWidth:200 }}>{f.comment}</td>
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

// ─── TAB: Analytics ─────────────────────────────────────────────────────────────
