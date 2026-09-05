import { C, B, Badge, Card, CardTitle, TableWrap, TH, TD, SH, Restrict } from './ui'
import { SKILL_GAPS } from './trainingSeedData'

export default function TabSkillGap({ canEdit: _canEdit, isAdmin, isHead, isUser, showToast }) {
  if (!isAdmin && !isHead && !isUser) return <Restrict text="Skill Gap Analysis is restricted to authorized training roles." />

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Skill Gap Analysis" sub="Required skills vs current levels by department">
        <button style={B.ghost}>⬇ Export Report</button>
      </SH>

      <Card>
        <CardTitle>Department Skill Gap Heatmap</CardTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12 }}>
          {SKILL_GAPS.map((g, i) => {
            const col = g.gap >= 51 ? { bg:'rgba(255,71,87,.2)', color:C.red } : g.gap >= 21 ? { bg:'rgba(255,214,0,.15)', color:C.yellow } : { bg:'rgba(0,200,150,.15)', color:C.green }
            return (
              <div key={i} onClick={() => showToast('Assign Program', `${g.prog} assigned to ${g.dept} team`)}
                style={{ borderRadius:6, padding:'10px 8px', textAlign:'center', cursor:'pointer', background:col.bg, transition:'all .15s' }}>
                <div style={{ fontSize:11, fontWeight:700, color:col.color, marginBottom:3 }}>{g.dept}</div>
                <div style={{ fontSize:10, opacity:.8, color:col.color }}>{g.skill.split(' ').slice(0,2).join(' ')}</div>
                <div style={{ fontSize:13, fontWeight:800, color:col.color, marginTop:3 }}>{g.gap}% gap</div>
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex', gap:14, fontSize:11 }}>
          <span style={{ color:C.red }}>⬛ High gap (&gt;50%)</span>
          <span style={{ color:C.yellow }}>⬛ Medium gap (21–50%)</span>
          <span style={{ color:C.green }}>⬛ Low gap (0–20%)</span>
        </div>
      </Card>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:850 }}>
            <thead><tr>
              {['Department','Required Skill','Required Level','Current Level','Gap %','Recommended Program','Action'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {SKILL_GAPS.map((g, i) => {
                const rowBg = g.gap >= 51 ? 'rgba(255,71,87,.04)' : g.gap >= 21 ? 'rgba(255,214,0,.03)' : 'rgba(0,200,150,.03)'
                const gapColor = g.gap >= 51 ? C.red : g.gap >= 21 ? C.yellow : C.green
                return (
                  <tr key={i} style={{ background:rowBg }}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{g.dept}</td>
                    <td style={TD}>{g.skill}</td>
                    <td style={TD}><Badge s={g.required} /></td>
                    <td style={TD}><Badge s={g.current} /></td>
                    <td style={{ ...TD, color:gapColor, fontWeight:800 }}>{g.gap}%</td>
                    <td style={{ ...TD, color:C.pur }}>{g.prog}</td>
                    <td style={TD}><button onClick={() => showToast('Program Assigned', `${g.prog} assigned to close ${g.dept} skill gap`)} style={{ ...B.pri, ...B.sm }}>Assign Program</button></td>
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

// ─── Modals ──────────────────────────────────────────────────────────────────────
