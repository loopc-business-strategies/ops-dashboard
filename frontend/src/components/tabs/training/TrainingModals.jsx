import { useState } from 'react'
import { C, B, Badge, ProgRow, IS, ML, MI, MS, MTA, Modal } from './ui'

export function ModalSession({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { title:'', prog:'Gold Safety Essentials', date:'', time:'', trainer:'', venue:'Training Room A', batch:'Batch A — Gold Safety', st:'Scheduled' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Training Session' : 'Add Training Session'} sub="Schedule or update a training session" onClose={onClose} onSave={() => f.title.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Session'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Session Title</ML><MI value={f.title} onChange={s('title')} placeholder="e.g. Gold Safety Induction" /></div>
        <div><ML>Program</ML><MS value={f.prog} onChange={s('prog')}>{['Gold Safety Essentials','Equipment Operation','Compliance & Legal','Leadership Development','Tech Skills'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Date</ML><input type="date" value={f.date} onChange={s('date')} style={IS} /></div>
        <div><ML>Time</ML><input type="time" value={f.time} onChange={s('time')} style={IS} /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Trainer</ML><MI value={f.trainer} onChange={s('trainer')} placeholder="Trainer name" /></div>
        <div><ML>Venue / Mode</ML><MS value={f.venue} onChange={s('venue')}>{['Training Room A','Online — Zoom','Site Floor','Classroom B'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Batch</ML><MS value={f.batch} onChange={s('batch')}>{['Batch A — Gold Safety','Batch B — Equipment','Batch C — Compliance','Batch D — Leadership'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Status</ML><MS value={f.st} onChange={s('st')}>{['Scheduled','Completed','Cancelled'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
    </Modal>
  )
}


export function ModalBatch({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { name:'', prog:'Gold Safety Essentials', start:'', end:'', trainer:'', trainees:0, completion:0, st:'Active' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Batch' : 'Create Batch'} sub="Register or update a training batch" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Create Batch'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Batch Name</ML><MI value={f.name} onChange={s('name')} placeholder="e.g. Batch E — New Joiners" /></div>
        <div><ML>Program</ML><MS value={f.prog} onChange={s('prog')}>{['Gold Safety Essentials','Equipment Operation','Compliance & Legal','Leadership Development','Tech Skills'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Start Date</ML><input type="date" value={f.start} onChange={s('start')} style={IS} /></div>
        <div><ML>End Date</ML><input type="date" value={f.end} onChange={s('end')} style={IS} /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Trainer</ML><MI value={f.trainer} onChange={s('trainer')} placeholder="Trainer name" /></div>
        <div><ML>Status</ML><MS value={f.st} onChange={s('st')}>{['Active','On Hold','Completed'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Trainee Count</ML><MI type="number" value={f.trainees} onChange={s('trainees')} min="0" /></div>
        <div><ML>Completion %</ML><MI type="number" value={f.completion} onChange={s('completion')} min="0" max="100" /></div>
      </div>
    </Modal>
  )
}

const ATT_TRAINEES = ['Ahmad Yusuf','Zara Malik','Hassan Ali','Bilal Raza','Omar Khan','Layla Siddiqui','Nadia Khan','Karim H.','Sara A.','Fatima N.','Ali B.','Tariq O.']

export function ModalAttendance({ onClose, showToast, onSaveRecord }) {
  const [state, setState] = useState({})
  function set(i, v) { setState(p => ({...p,[i]:v})) }

  return (
    <Modal title="Mark Attendance" sub="Gold Safety — Module 1 · Batch A · Apr 13" onClose={onClose}
      onSave={() => {
        const p = Object.values(state).filter(v=>v==='P').length
        const a = Object.values(state).filter(v=>v==='A').length
        const l = Object.values(state).filter(v=>v==='L').length
        onSaveRecord?.({ sess:'Manual Attendance Entry', date:'Today', batch:'Batch A', present:p, absent:a, late:l, total:p+a+l })
        showToast('Attendance Saved', `Present: ${p} · Absent: ${a} · Late: ${l}`)
        onClose()
      }} saveLabel="Save Attendance">
      <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:280, overflowY:'auto', marginBottom:12 }}>
        {ATT_TRAINEES.map((t, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'rgba(255,255,255,.03)', borderRadius:8, border:`1px solid ${C.border}` }}>
            <span style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{t}</span>
            <div style={{ display:'flex', gap:5 }}>
              {[['P','Present',C.green],['A','Absent',C.red],['L','Late',C.yellow]].map(([v,lbl,col]) => (
                <button key={v} onClick={() => set(i, v)}
                  style={{ padding:'4px 12px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', fontFamily:'inherit', transition:'all .15s',
                    background: state[i]===v ? col : `${col}18`,
                    color: state[i]===v ? (v==='A'?'#fff':'#131313') : col }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}


export function ModalAssessment({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, score:String(initial.score), attempt:String(initial.attempt) } : { trainee:'Ahmad Yusuf', prog:'Gold Safety Essentials', score:'', attempt:'1', date:'Apr 13, 2026' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Assessment Result' : 'Add Assessment Result'} sub="Record or update a trainee's assessment score" onClose={onClose}
      onSave={() => { if (!f.score) return; onSave(f) }} saveLabel={isEdit ? 'Save Changes' : 'Save Result'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Trainee</ML><MS value={f.trainee} onChange={s('trainee')}>{['Ahmad Yusuf','Zara Malik','Hassan Ali','Nadia Khan','Layla Siddiqui','Bilal Raza'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Program</ML><MS value={f.prog} onChange={s('prog')}>{['Gold Safety Essentials','Equipment Operation','Compliance & Legal','Leadership Development'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Score (%)</ML><MI type="number" value={f.score} onChange={s('score')} placeholder="0–100" min="0" max="100" /></div>
        <div><ML>Attempt #</ML><MI type="number" value={f.attempt} onChange={s('attempt')} min="1" /></div>
      </div>
      <div><ML>Date</ML><MI value={f.date} onChange={s('date')} placeholder="Apr 13, 2026" /></div>
    </Modal>
  )
}


export function ModalResource({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { name:'', prog:'Gold Safety Essentials', type:'PDF', by:'', date:'', views:0 })
  const s = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Resource' : 'Upload Resource'} sub="Manage training library files" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Upload'}>
      <div><ML>File Name</ML><MI value={f.name} onChange={s('name')} placeholder="Resource file name" /></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Program</ML><MS value={f.prog} onChange={s('prog')}>{['Gold Safety Essentials','Equipment Operation','Compliance & Legal','Leadership Development','Tech Skills'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Type</ML><MS value={f.type} onChange={s('type')}>{['PDF','Video','Document'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Uploaded By</ML><MI value={f.by} onChange={s('by')} placeholder="Your name" /></div>
        <div><ML>Date</ML><MI value={f.date} onChange={s('date')} placeholder="Apr 20, 2026" /></div>
      </div>
      <div><ML>Views</ML><MI type="number" value={f.views} onChange={s('views')} min="0" /></div>
    </Modal>
  )
}


export function ModalCert({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { trainee:'Ahmad Yusuf', cert:'', issued:'', expiry:'', st:'Pending', doc:'' })
  const s = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Certificate' : 'Issue Certificate'} sub="Create or update certification record" onClose={onClose} onSave={() => f.cert.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Issue Cert'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Trainee</ML><MI value={f.trainee} onChange={s('trainee')} /></div>
        <div><ML>Certificate</ML><MI value={f.cert} onChange={s('cert')} placeholder="Certificate name" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Issued Date</ML><MI value={f.issued} onChange={s('issued')} placeholder="Apr 20, 2026" /></div>
        <div><ML>Expiry Date</ML><MI value={f.expiry} onChange={s('expiry')} placeholder="Apr 20, 2028" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Status</ML><MS value={f.st} onChange={s('st')}>{['Issued','Pending','Expired'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Doc File</ML><MI value={f.doc} onChange={s('doc')} placeholder="cert_file.pdf" /></div>
      </div>
    </Modal>
  )
}


export function ModalTrainee({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, prog:Array.isArray(initial.prog) ? initial.prog.join(', ') : initial.prog } : { name:'', dept:'Operations', role:'', email:'', prog:'Gold Safety Essentials', att:0, certs:0 })
  const s = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Trainee' : 'Enroll Trainee'} sub="Create or update trainee profile" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Enroll'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Name</ML><MI value={f.name} onChange={s('name')} placeholder="Full name" /></div>
        <div><ML>Email</ML><MI value={f.email} onChange={s('email')} placeholder="name@ops.kz" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Department</ML><MS value={f.dept} onChange={s('dept')}>{['Operations','Production','Quality','Training','Sales','Finance','HR'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Role</ML><MI value={f.role} onChange={s('role')} placeholder="Job title" /></div>
      </div>
      <div><ML>Programs (comma-separated)</ML><MI value={f.prog} onChange={s('prog')} placeholder="Gold Safety Essentials, Tech Skills" /></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Attendance %</ML><MI type="number" value={f.att} onChange={s('att')} min="0" max="100" /></div>
        <div><ML>Certificates</ML><MI type="number" value={f.certs} onChange={s('certs')} min="0" /></div>
      </div>
    </Modal>
  )
}


export function ModalFeedback({ onClose, onAdd }) {
  const [ratings, setRatings] = useState({ trainer:0, content:0, venue:0 })
  const [comment, setComment] = useState('')

  function StarInput({ label, rk }) {
    return (
      <div style={{ marginBottom:14 }}>
        <ML>{label}</ML>
        <div style={{ display:'flex', gap:6 }}>
          {[1,2,3,4,5].map(v => (
            <span key={v} onClick={() => setRatings(p => ({...p,[rk]:v}))}
              style={{ fontSize:24, cursor:'pointer', color: v <= ratings[rk] ? C.gold : C.t4, transition:'transform .1s' }}>★</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Modal title="Submit Session Feedback" sub="Rate your experience for this training session" onClose={onClose}
      onSave={() => {
        if (!ratings.trainer) { return }
        onAdd({ trainerRating:ratings.trainer, contentRating:ratings.content||3, venueRating:ratings.venue||3, comment:comment||'No comment' })
      }} saveLabel="Submit Feedback">
      <StarInput label="Trainer Rating" rk="trainer" />
      <StarInput label="Content Rating" rk="content" />
      <StarInput label="Venue / Setup Rating" rk="venue" />
      <ML>Comments</ML>
      <MTA value={comment} onChange={e => setComment(e.target.value)} placeholder="Share your experience..." />
    </Modal>
  )
}


export function ModalProfile({ name, trainees, assessments, certs, canEdit, showToast, onClose }) {
  const t = trainees.find(x => x.name === name)
  if (!t) return null
  const myAss   = assessments.filter(a => a.trainee === name)
  const myCerts = certs.filter(c => c.trainee === name && c.st === 'Issued')

  return (
    <Modal title={t.name} sub={`${t.dept} · ${t.role} · ${t.email}`} onClose={onClose} wide
      onSave={() => { showToast('PDF Export','Individual profile report exported'); onClose() }} saveLabel="⬇ Export PDF">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:11, marginBottom:14 }}>
        {[['Attendance', `${t.att}%`, t.att < 75 ? C.red : C.green],['Certifications', t.certs, C.pur],['Programs', t.prog.length, C.cyan]].map(([lbl,val,col]) => (
          <div key={lbl} style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', marginBottom:6 }}>{lbl}</div>
            <div style={{ fontSize:20, fontWeight:800, color:col }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ fontWeight:700, color:C.t1, marginBottom:8, fontSize:13 }}>Enrolled Programs</div>
      {t.prog.map(p => <ProgRow key={p} label={p.split(' ').slice(0,3).join(' ')} p={65} color={C.gbar} />)}
      {myAss.length > 0 && <>
        <div style={{ fontWeight:700, color:C.t1, margin:'14px 0 8px', fontSize:13 }}>Assessment Scores</div>
        {myAss.map((a, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
            <span style={{ color:C.t2 }}>{a.prog}</span>
            <span style={{ fontWeight:700, color: a.pass ? C.green : C.red }}>{a.score}% — {a.pass ? 'Pass' : 'Fail'}</span>
          </div>
        ))}
      </>}
      {myCerts.length > 0 && <>
        <div style={{ fontWeight:700, color:C.t1, margin:'14px 0 8px', fontSize:13 }}>Certificates</div>
        {myCerts.map((c, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
            <Badge s="Issued" />
            <span style={{ fontWeight:600, color:C.t1 }}>{c.cert}</span>
            <span style={{ color:C.t3 }}>Exp: {c.expiry}</span>
          </div>
        ))}
      </>}
      {canEdit && (
        <div style={{ marginTop:14 }}>
          <ML>Trainer Remarks</ML>
          <MTA placeholder="Add remarks about this trainee..." />
        </div>
      )}
    </Modal>
  )
}


export function ModalSessionDetail({ sess, onClose, onMarkAtt }) {
  if (!sess) return null
  return (
    <Modal title={sess.title} sub="Session Details" onClose={onClose}
      onSave={onMarkAtt} saveLabel="Mark Attendance">
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11, marginBottom:14 }}>
        <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', marginBottom:6 }}>Status</div>
          <Badge s={sess.st} />
        </div>
        <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'12px 14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', marginBottom:6 }}>Date & Time</div>
          <div style={{ fontSize:14, fontWeight:700, color:C.t1 }}>{sess.date} · {sess.time}</div>
        </div>
      </div>
      <div style={{ fontSize:13, color:C.t2, marginBottom:6 }}>📚 <strong style={{color:C.t1}}>Program:</strong> {sess.prog}</div>
      <div style={{ fontSize:13, color:C.t2, marginBottom:6 }}>🧑‍🏫 <strong style={{color:C.t1}}>Trainer:</strong> {sess.trainer}</div>
      <div style={{ fontSize:13, color:C.t2, marginBottom:6 }}>👥 <strong style={{color:C.t1}}>Batch:</strong> {sess.batch}</div>
      <div style={{ fontSize:13, color:C.t2 }}>📍 <strong style={{color:C.t1}}>Venue:</strong> {sess.venue}</div>
    </Modal>
  )
}

// ─── Notifications Panel ────────────────────────────────────────────────────────

export function NotifPanel({ notifs, setNotifs, onClose }) {
  const unread = notifs.filter(n => !n.read).length
  const lvColor = { red:C.red, yellow:C.yellow, orange:C.orange, green:C.green, cyan:C.cyan }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:890 }} />
      <div style={{ position:'fixed', top:0, right:0, width:380, height:'100vh', background:'#ffffff', borderLeft:`1px solid ${C.border2}`, zIndex:900, display:'flex', flexDirection:'column', boxShadow:'-8px 0 40px rgba(0,0,0,.15)' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f8f9fa' }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.t1, display:'flex', alignItems:'center', gap:8 }}>
            🔔 Training Alerts
            {unread > 0 && <span style={{ background:C.red, color:'#fff', fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20 }}>{unread} new</span>}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.t3, fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'10px 12px' }}>
          {notifs.length === 0 && <div style={{ textAlign:'center', padding:40, color:C.t4 }}>🔔<br/>No alerts</div>}
          {notifs.map(n => {
            const col = lvColor[n.lv] || C.cyan
            return (
              <div key={n.id} style={{ background:n.read?'rgba(255,255,255,.01)':'rgba(255,255,255,.03)', border:`1px solid rgba(255,255,255,.05)`, borderLeft:`3px solid ${col}`, borderRadius:9, padding:'11px 13px', marginBottom:7, opacity: n.read ? .5 : 1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:col, marginBottom:3 }}>{n.title}</div>
                <div style={{ fontSize:11, color:C.t3, lineHeight:1.5, marginBottom:6 }}>{n.desc}</div>
                <div style={{ display:'flex', gap:5 }}>
                  {!n.read && <button onClick={() => setNotifs(p => p.map(x => x.id===n.id ? {...x,read:true} : x))} style={{ padding:'3px 10px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(0,200,150,.12)', color:C.green, fontFamily:'inherit' }}>✓ Read</button>}
                  <button onClick={() => setNotifs(p => p.filter(x => x.id !== n.id))} style={{ padding:'3px 10px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(255,255,255,.06)', color:C.t3, fontFamily:'inherit' }}>✕ Dismiss</button>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding:'10px 12px', borderTop:`1px solid ${C.border}`, display:'flex', gap:7 }}>
          <button onClick={() => setNotifs(p => p.map(n => ({...n,read:true})))} style={{ flex:1, padding:8, borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:C.grad, color:'#fff' }}>✓ Mark all read</button>
          <button onClick={() => setNotifs(p => p.filter(n => !n.read))} style={{ flex:1, padding:8, borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${C.border}`, background:'rgba(255,255,255,.06)', color:C.t3 }}>🗑 Clear read</button>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
