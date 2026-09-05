export function getTrainingTabs(t) {
  return [
    { id:'kpi',         label:`📊 ${t('overview')}` },
    { id:'calendar',    label:`📅 ${t('calendar')}` },
    { id:'batches',     label:`👥 ${t('batches')}` },
    { id:'attendance',  label:`📋 ${t('attendance')}` },
    { id:'resources',   label:`📚 ${t('resources')}` },
    { id:'assessments', label:`📝 ${t('assessments')}` },
    { id:'certs',       label:`🏆 ${t('certifications')}` },
    { id:'feedback',    label:`💬 ${t('feedback')}` },
    { id:'analytics',   label:`📈 ${t('analytics')}` },
    { id:'trainees',    label:`👤 ${t('trainees')}` },
    { id:'skillgap',    label:`🗓️ ${t('skillGap')}` },
  ]
}

export const INIT_SESSIONS = [
  { id:1, title:'Gold Safety — Module 1',   prog:'Gold Safety Essentials',   date:'Apr 13', day:13, time:'09:00', trainer:'James O.', batch:'Batch A', venue:'Training Room A',  st:'Completed' },
  { id:2, title:'Equipment Operation',       prog:'Equipment Operation',       date:'Apr 14', day:14, time:'10:30', trainer:'Nadia K.', batch:'Batch B', venue:'Site Floor',        st:'Scheduled' },
  { id:3, title:'Compliance Basics',         prog:'Compliance & Legal',        date:'Apr 15', day:15, time:'14:00', trainer:'Sara A.',  batch:'Batch C', venue:'Online — Zoom',     st:'Scheduled' },
  { id:4, title:'Leadership Workshop',       prog:'Leadership Development',    date:'Apr 17', day:17, time:'11:00', trainer:'James O.', batch:'Batch D', venue:'Classroom B',       st:'Scheduled' },
  { id:5, title:'Gold Safety — Module 2',   prog:'Gold Safety Essentials',   date:'Apr 20', day:20, time:'09:00', trainer:'James O.', batch:'Batch A', venue:'Training Room A',  st:'Scheduled' },
  { id:6, title:'Tech Skills — Excel',       prog:'Tech Skills',               date:'Apr 10', day:10, time:'13:00', trainer:'Nadia K.', batch:'Batch E', venue:'Online — Zoom',     st:'Completed' },
  { id:7, title:'Safety Drill',              prog:'Gold Safety Essentials',   date:'Apr 8',  day:8,  time:'08:00', trainer:'Sara A.',  batch:'Batch A', venue:'Site Floor',        st:'Cancelled' },
]

export const INIT_BATCHES = [
  { id:1, name:'Batch A — Gold Safety',   prog:'Gold Safety Essentials',  start:'Apr 1, 2026',  end:'Apr 30, 2026',  trainer:'James O.', trainees:12, st:'Active',    completion:65 },
  { id:2, name:'Batch B — Equipment',     prog:'Equipment Operation',      start:'Apr 5, 2026',  end:'May 15, 2026',  trainer:'Nadia K.', trainees:8,  st:'Active',    completion:40 },
  { id:3, name:'Batch C — Compliance',    prog:'Compliance & Legal',       start:'Mar 15, 2026', end:'Apr 15, 2026',  trainer:'Sara A.',  trainees:15, st:'Completed', completion:100 },
  { id:4, name:'Batch D — Leadership',    prog:'Leadership Development',   start:'Apr 10, 2026', end:'May 20, 2026',  trainer:'James O.', trainees:6,  st:'Active',    completion:25 },
  { id:5, name:'Batch E — Tech Skills',   prog:'Tech Skills',              start:'Mar 1, 2026',  end:'Mar 31, 2026',  trainer:'Nadia K.', trainees:10, st:'Completed', completion:100 },
  { id:6, name:'Batch F — On Hold',       prog:'Gold Safety Essentials',  start:'May 1, 2026',  end:'May 31, 2026',  trainer:'TBD',      trainees:0,  st:'On Hold',   completion:0 },
]

export const INIT_ATTENDANCE = [
  { sess:'Gold Safety — Module 1', date:'Apr 13', batch:'Batch A', present:10, absent:2, late:1, total:12 },
  { sess:'Tech Skills — Excel',    date:'Apr 10', batch:'Batch E', present:9,  absent:1, late:0, total:10 },
  { sess:'Compliance Basics',      date:'Apr 5',  batch:'Batch C', present:12, absent:2, late:1, total:15 },
  { sess:'Safety Drill',           date:'Apr 8',  batch:'Batch A', present:7,  absent:5, late:0, total:12 },
]

export const INIT_RESOURCES = [
  { id:1, name:'Gold Safety Handbook v2.pdf',          prog:'Gold Safety Essentials',  type:'PDF',      by:'Nadia K.', date:'Apr 1, 2026',  views:28 },
  { id:2, name:'Equipment Operation Manual v1.pdf',    prog:'Equipment Operation',      type:'PDF',      by:'James O.', date:'Mar 20, 2026', views:14 },
  { id:3, name:'Compliance Guidelines 2026.pdf',       prog:'Compliance & Legal',       type:'PDF',      by:'Sara A.',  date:'Feb 15, 2026', views:22 },
  { id:4, name:'Leadership Skills — Video Tutorial',   prog:'Leadership Development',   type:'Video',    by:'Nadia K.', date:'Apr 5, 2026',  views:9  },
  { id:5, name:'Excel Advanced Techniques.xlsx',       prog:'Tech Skills',              type:'Document', by:'Nadia K.', date:'Mar 2, 2026',  views:31 },
  { id:6, name:'Safety Drill Checklist v2.pdf',        prog:'Gold Safety Essentials',  type:'PDF',      by:'James O.', date:'Apr 10, 2026', views:6  },
]

export const INIT_ASSESSMENTS = [
  { trainee:'Ahmad Yusuf',    prog:'Gold Safety Essentials',  score:88, pass:true,  date:'Apr 13, 2026', attempt:1 },
  { trainee:'Zara Malik',     prog:'Gold Safety Essentials',  score:94, pass:true,  date:'Apr 13, 2026', attempt:1 },
  { trainee:'Hassan Ali',     prog:'Gold Safety Essentials',  score:62, pass:false, date:'Apr 13, 2026', attempt:1 },
  { trainee:'Nadia Khan',     prog:'Compliance & Legal',      score:97, pass:true,  date:'Apr 10, 2026', attempt:1 },
  { trainee:'Layla Siddiqui', prog:'Tech Skills',             score:76, pass:true,  date:'Mar 28, 2026', attempt:1 },
  { trainee:'Bilal Raza',     prog:'Equipment Operation',     score:55, pass:false, date:'Apr 14, 2026', attempt:1 },
  { trainee:'Hassan Ali',     prog:'Gold Safety Essentials',  score:74, pass:true,  date:'Apr 20, 2026', attempt:2 },
]

export const INIT_CERTS = [
  { trainee:'Ahmad Yusuf',    cert:'Gold Safety Level 1',       issued:'Apr 14, 2026', expiry:'Apr 14, 2028', st:'Issued',  doc:'cert_ahmad_gs1.pdf' },
  { trainee:'Zara Malik',     cert:'Gold Safety Level 1',       issued:'Apr 14, 2026', expiry:'Apr 14, 2028', st:'Issued',  doc:'cert_zara_gs1.pdf' },
  { trainee:'Nadia Khan',     cert:'Compliance Officer Cert',   issued:'Apr 10, 2026', expiry:'Apr 10, 2027', st:'Issued',  doc:'cert_nadia_compliance.pdf' },
  { trainee:'Layla Siddiqui', cert:'Tech Skills Certificate',   issued:'Mar 30, 2026', expiry:'Mar 30, 2028', st:'Issued',  doc:'cert_layla_tech.pdf' },
  { trainee:'Hassan Ali',     cert:'Gold Safety Level 1',       issued:'—',            expiry:'—',            st:'Pending', doc:'—' },
  { trainee:'Bilal Raza',     cert:'Equipment Operator Cert',   issued:'—',            expiry:'—',            st:'Pending', doc:'—' },
  { trainee:'Omar Khan',      cert:'Leadership Certificate',    issued:'Jan 15, 2025', expiry:'Jan 15, 2026', st:'Expired', doc:'cert_omar_leadership.pdf' },
]

export const INIT_FEEDBACK = [
  { trainer:'James O.', trainee:'Ahmad Yusuf',    session:'Gold Safety — Module 1', trainerRating:5, contentRating:4, venueRating:4, comment:'Very well explained. Practical examples were excellent.' },
  { trainer:'James O.', trainee:'Zara Malik',     session:'Gold Safety — Module 1', trainerRating:5, contentRating:5, venueRating:3, comment:'Great trainer. Room was a bit cold but content was perfect.' },
  { trainer:'Nadia K.', trainee:'Layla Siddiqui', session:'Tech Skills — Excel',    trainerRating:4, contentRating:5, venueRating:5, comment:'Online session was smooth. Loved the hands-on exercises.' },
  { trainer:'Sara A.',  trainee:'Nadia Khan',     session:'Compliance Basics',      trainerRating:4, contentRating:4, venueRating:4, comment:'Covered all the key regulations. Could use more case studies.' },
]

export const INIT_TRAINEES = [
  { name:'Ahmad Yusuf',    dept:'Production', role:'Line Operator', email:'ahmad@ops.kz',  prog:['Gold Safety Essentials'],                       att:83,  certs:1 },
  { name:'Zara Malik',     dept:'Quality',    role:'Inspector',     email:'zara@ops.kz',   prog:['Gold Safety Essentials'],                       att:100, certs:1 },
  { name:'Hassan Ali',     dept:'Production', role:'Line Operator', email:'hassan@ops.kz', prog:['Gold Safety Essentials'],                       att:58,  certs:0 },
  { name:'Nadia Khan',     dept:'Training',   role:'Trainer',       email:'nadia@ops.kz',  prog:['Compliance & Legal','Leadership Development'],  att:92,  certs:1 },
  { name:'Layla Siddiqui', dept:'Sales',      role:'Sales Rep',     email:'layla@ops.kz',  prog:['Tech Skills'],                                  att:90,  certs:1 },
  { name:'Bilal Raza',     dept:'Operations', role:'Logistics',     email:'bilal@ops.kz',  prog:['Equipment Operation'],                          att:75,  certs:0 },
  { name:'Omar Khan',      dept:'Operations', role:'Ops Head',      email:'omar@ops.kz',   prog:['Leadership Development'],                       att:88,  certs:0 },
]

export const SKILL_GAPS = [
  { dept:'Production',  skill:'Gold Processing Safety',       required:'Advanced',     current:'Basic',        gap:60, prog:'Gold Safety Essentials' },
  { dept:'Production',  skill:'Equipment Operation',          required:'Intermediate', current:'Basic',        gap:45, prog:'Equipment Operation' },
  { dept:'Operations',  skill:'Logistics Compliance',         required:'Advanced',     current:'Intermediate', gap:30, prog:'Compliance & Legal' },
  { dept:'HR',          skill:'HR Digital Tools',             required:'Advanced',     current:'Beginner',     gap:70, prog:'Tech Skills' },
  { dept:'Finance',     skill:'Advanced Excel & Reporting',   required:'Advanced',     current:'Intermediate', gap:25, prog:'Tech Skills' },
  { dept:'Sales',       skill:'Contract Negotiation',         required:'Expert',       current:'Intermediate', gap:50, prog:'Leadership Development' },
  { dept:'Compliance',  skill:'Regulatory Updates 2026',      required:'Expert',       current:'Advanced',     gap:15, prog:'Compliance & Legal' },
  { dept:'Training',    skill:'Digital Training Delivery',    required:'Advanced',     current:'Intermediate', gap:20, prog:'Tech Skills' },
]

export const INIT_NOTIFS = [
  { id:'TN1', lv:'red',    read:false, title:'🔴 Overdue Task — Hassan Ali Assessment Retest',    desc:'Hassan Ali failed Gold Safety assessment. Retest scheduled but not yet completed. Due Apr 16.' },
  { id:'TN2', lv:'yellow', read:false, title:'🟡 Session Tomorrow — Equipment Operation (10:30)', desc:'Batch B session scheduled for Apr 14 at 10:30 on Site Floor. Trainer: Nadia K.' },
  { id:'TN3', lv:'orange', read:false, title:'🟠 Certificate Expiring — Omar Khan Leadership',    desc:"Omar Khan's Leadership Certificate expired Jan 2026. Renewal required immediately." },
  { id:'TN4', lv:'green',  read:false, title:'🟢 New Enrollment — Bilal Raza (Equipment Op.)',   desc:'Bilal Raza has been enrolled in Equipment Operation — Batch B starting Apr 5.' },
  { id:'TN5', lv:'red',    read:true,  title:'🔴 Low Attendance — Hassan Ali (58%)',              desc:'Hassan Ali attendance has dropped to 58% in Gold Safety. Minimum required: 75%.' },
  { id:'TN6', lv:'cyan',   read:true,  title:'🔵 Batch C Completed — Compliance & Legal',        desc:'All 15 trainees in Batch C have completed the Compliance & Legal program. Reports available.' },
]
