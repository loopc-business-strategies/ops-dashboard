import { OPS_C as C } from './operationsTabTokens'
import { B, Badge, ProgBar, ProgRow, Card, CardTitle, TableWrap, SH, Restrict, TH, TD } from './operationsTabUI'
import { opsPct as pct } from './operationsSeedData'

export default function TabGold({ gold, setGold: _setGold, canEdit: _canEdit, isAdmin, isHead, isMgmt, isExternal, showToast, setModal }) {
  if (isExternal) return <Restrict amber text="Gold Sourcing data is confidential. Contact Operations Head for access." />
  if (!isAdmin && !isHead && !isMgmt) return <Restrict amber text="Gold Sourcing data is confidential. Contact Operations Head for access." />
  const limitedView = isMgmt && !isAdmin && !isHead

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH
        title={<>Gold Sourcing Channels {limitedView && <span style={{ fontSize:12, color:C.yellow, fontWeight:500 }}> ⚠ Limited View</span>}</>}
        sub={limitedView ? 'Volume and status data only — channel names and contacts are restricted' : 'Confidential — Super Admin & Operations Head full access'}
      >
        {isAdmin && <button style={B.pri} onClick={() => setModal({ type:'gold-add', data:null })}>+ Add Channel</button>}
      </SH>

      <TableWrap>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth: limitedView ? 600 : 1000 }}>
            <thead><tr>
              <th style={TH}>Channel ID</th>
              {!limitedView && <th style={TH}>Channel Name</th>}
              {isAdmin && !limitedView && <th style={TH}>Actions</th>}
              <th style={TH}>Region</th>
              <th style={TH}>Vol. Target (kg)</th>
              <th style={TH}>Actual (kg)</th>
              <th style={TH}>Performance</th>
              <th style={TH}>Stage</th>
              <th style={TH}>Contract</th>
              {!limitedView && <><th style={TH}>Compliance</th><th style={TH}>Risk</th><th style={TH}>Last Activity</th><th style={TH}>Next Action</th></>}
            </tr></thead>
            <tbody>
              {gold.map(g => {
                const perf = pct(g.actual, g.vol || 1)
                return (
                  <tr key={g.id} style={{ cursor:'pointer' }} onClick={() => !limitedView && !isAdmin && showToast('Channel Detail', `Negotiation history for ${g.code}`)}>
                    <td style={TD}><span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'rgba(245,158,11,.12)', color:C.gold, border:'1px solid rgba(245,158,11,.3)' }}>{g.code}</span></td>
                    {!limitedView && <td style={{ ...TD, fontWeight:700, color:C.t1 }}>{g.name}</td>}
                    <td style={{ ...TD, color:C.t3 }}>{g.region}</td>
                    <td style={{ ...TD, color:C.gold, fontWeight:700 }}>{g.vol} kg</td>
                    <td style={{ ...TD, color:C.t2 }}>{g.actual} kg</td>
                    <td style={{ ...TD, minWidth:120 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <ProgBar pct={perf} color={perf>=80?C.green:perf>=50?C.yellow:C.red} />
                        <span style={{ fontSize:11, fontWeight:700, color:C.t1, width:34, textAlign:'right' }}>{perf}%</span>
                      </div>
                    </td>
                    <td style={TD}><Badge s={g.stage} /></td>
                    <td style={TD}><Badge s={g.cst} /></td>
                    {!limitedView && <>
                      <td style={TD}><Badge s={g.comp === 'Yes' ? 'Yes' : 'No'} /></td>
                      <td style={TD}><Badge s={g.risk} /></td>
                      <td style={{ ...TD, color:C.t3 }}>{g.lastAct}</td>
                      <td style={{ ...TD, color:C.cyan, fontSize:11 }}>{g.nextAction}</td>
                    </>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>

      {!limitedView && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Card>
            <CardTitle>Volume Performance by Channel</CardTitle>
            {gold.map(g => <ProgRow key={g.id} label={`${g.code} — ${g.region}`} p={pct(g.actual, g.vol || 1)} color={g.risk==='High' ? C.red : g.risk==='Medium' ? C.yellow : C.green} />)}
          </Card>
          <Card>
            <CardTitle>Channel Risk Distribution</CardTitle>
            {[['Low', C.green], ['Medium', C.yellow], ['High', C.red]].map(([r, c]) => (
              <ProgRow key={r} label={`Risk Level: ${r}`} p={pct(gold.filter(g => g.risk === r).length, gold.length)} color={c} />
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── TAB: Transport Routes ──────────────────────────────────────────────────────
