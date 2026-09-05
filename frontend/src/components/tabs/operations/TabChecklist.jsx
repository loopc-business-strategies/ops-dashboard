import { OPS_C as C } from './operationsTabTokens'
import { B, Badge, ProgBar, StatCard, TableWrap, TableHead, SH, Restrict, TH, TD } from './operationsTabUI'
import { opsPct as pct } from './operationsSeedData'

export default function TabChecklist({ checklist, setChecklist, canEdit, isExternal, isMgmt, setModal }) {
  if (isExternal || isMgmt) return <Restrict text="Operational Readiness Checklist is restricted to Operations team." />
  const done    = checklist.filter(c => c.st === 'Done').length
  const inprog  = checklist.filter(c => c.st === 'In Progress').length
  const blocked = checklist.filter(c => c.st === 'Blocked').length
  const p = pct(done, checklist.length)
  const readColor = p >= 80 ? C.green : p >= 60 ? C.yellow : C.red

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Operational Readiness Checklist" sub={`${done} of ${checklist.length} items complete — ${p}% ready`}>
        {canEdit && <button style={B.pri} onClick={() => setModal({ type:'checklist-add', data:null })}>+ Add Item</button>}
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Overall Readiness" value={<span style={{ color:readColor }}>{p}%</span>} sub={<ProgBar pct={p} color={C.gbar} />} />
        <StatCard label="Completed" value={<span style={{ color:C.green }}>{done}</span>} sub="Items done" dot={C.green} />
        <StatCard label="In Progress" value={<span style={{ color:C.yellow }}>{inprog}</span>} sub="Being worked on" dot={C.yellow} />
        <StatCard label="Blocked" value={<span style={{ color:C.red }}>{blocked}</span>} sub="Needs resolution" dot={C.red} />
      </div>

      <TableWrap>
        <TableHead title="Readiness Sub-Items" subtitle={`${checklist.length} items`} />
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
            <thead><tr>
              {['Checklist Item','Assigned To','Status','Due Date','Completed By','Timestamp','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {checklist.map((c, i) => {
                const rowBg = c.st === 'Done' ? 'rgba(0,200,150,.04)' : c.st === 'Blocked' ? 'rgba(255,71,87,.04)' : 'rgba(255,214,0,.03)'
                return (
                  <tr key={i} style={{ background:rowBg }}>
                    <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{c.item}</td>
                    <td style={{ ...TD, color:C.t2 }}>{c.assign}</td>
                    <td style={TD}><Badge s={c.st} /></td>
                    <td style={{ ...TD, color:C.t3 }}>{c.due}</td>
                    <td style={{ ...TD, color: c.by === '—' ? C.t4 : C.green }}>{c.by}</td>
                    <td style={{ ...TD, color:C.t4, fontSize:11 }}>{c.ts}</td>
                    <td style={TD}>
                      {canEdit && c.st !== 'Done' && <button onClick={() => {
                        setChecklist(p => p.map((x,j) => j===i ? {...x, st:'Done', by:'You', ts:'Now'} : x))
                      }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--purple)', fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>✓ Done</button>}
                      {canEdit && c.st === 'Done' && <button onClick={() => {
                        setChecklist(p => p.map((x,j) => j===i ? {...x, st:'In Progress', by:'—', ts:'—'} : x))
                      }} style={{ background:'none', border:'none', cursor:'pointer', color:C.t3, fontSize:12, fontWeight:700, fontFamily:'inherit', marginRight:8 }}>Undo</button>}
                      {canEdit && <button onClick={() => { if (window.confirm('Delete this item?')) setChecklist(p => p.filter((_,j) => j!==i)) }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:12, fontWeight:700, fontFamily:'inherit' }}>🗑</button>}
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

// ─── TAB: Supply Chain ──────────────────────────────────────────────────────────
