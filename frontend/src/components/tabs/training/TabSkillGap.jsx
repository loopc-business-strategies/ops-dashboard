import { C, Card, CardTitle, SH, Restrict } from './ui'

export default function TabSkillGap({ canEdit: _canEdit, isAdmin, isHead, isUser }) {
  if (!isAdmin && !isHead && !isUser) return <Restrict text="Skill Gap Analysis is restricted to authorized training roles." />

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Skill Gap Analysis" sub="Required skills vs current levels by department" />

      <Card>
        <CardTitle>No skill-gap data yet</CardTitle>
        <p style={{ margin:0, fontSize:13, color:C.t2, lineHeight:1.5 }}>
          Skill gap analysis will appear here when department skill assessments are recorded in Training.
          Demo heatmap metrics have been removed.
        </p>
      </Card>
    </div>
  )
}
