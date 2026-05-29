// FILE: src/components/tabs/ChatTab.jsx
// Redesigned Chat — matching refined prototype style

import { useState, useEffect, useRef } from 'react'
import { useAuth }        from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../context/LanguageContext'
import messagesAPI from '../../api/messages'

const resolveApiOrigin = () => {
  const configured = String(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  if (!configured || typeof window === 'undefined') return configured

  try {
    const parsed = new URL(configured)
    const currentHost = String(window.location.hostname || '').toLowerCase()
    const targetHost = String(parsed.hostname || '').toLowerCase()
    const isLoopbackHost = targetHost === 'localhost' || targetHost === '127.0.0.1' || targetHost === '::1'
    if (currentHost.endsWith('.localhost') && isLoopbackHost) {
      parsed.hostname = currentHost
      return parsed.toString().replace(/\/$/, '')
    }
  } catch {
    return configured
  }

  return configured
}

const API_ORIGIN = resolveApiOrigin()
const REALTIME_URL = `${API_ORIGIN}/api/realtime/events`

/** Demo chats / roster only when explicitly enabled in local dev (never in production builds). */
const USE_SEED_DATA =
  !import.meta.env.PROD
  && import.meta.env.DEV
  && String(import.meta.env.VITE_ENABLE_SEED_DATA || '').toLowerCase() === 'true'

function senderKeyFromName(name) {
  const raw = String(name || 'member')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'member'
  return `name:${raw}`
}

// ─────────────────────────────────────────────────────────
// DESIGN TOKENS (matching prototype exactly)
// ─────────────────────────────────────────────────────────
const C = {
  sidebar:       '#ffffff',
  sidebarHover:  '#f0faf5',
  sidebarActive: '#e6f5ef',
  main:          '#f8f9fa',
  bubbleIn:      '#f0f2f5',
  bubbleMe:      'var(--purple)',
  inputBg:       '#ffffff',
  border:        'rgba(var(--purple-rgb),0.12)',
  accent:        'var(--purple)',
  accent2:       'var(--purple)',
}

// ─────────────────────────────────────────────────────────
// Optional demo roster / chats (VITE_ENABLE_SEED_DATA=true in dev only)
// ─────────────────────────────────────────────────────────
const SEED_USERS = USE_SEED_DATA ? [
  { id: 'sa',       name: 'Admin',        dept: 'Admin',      color: 'var(--purple)', initials: 'SA' },
  { id: 'ali',      name: 'Ali Hassan',   dept: 'Production', color: '#60a5fa', initials: 'AH' },
  { id: 'sara',     name: 'Sara Ahmed',   dept: 'Compliance', color: '#c084fc', initials: 'SA' },
  { id: 'fatima',   name: 'Fatima Noor',  dept: 'HR',         color: '#2dd4bf', initials: 'FN' },
  { id: 'omar',     name: 'Omar Khan',    dept: 'Operations', color: '#fbbf24', initials: 'OK' },
  { id: 'investor', name: 'Mr. Investor', dept: 'Management', color: '#94a3b8', initials: 'MI' },
] : []

const T = Date.now()
const INITIAL_CHATS = USE_SEED_DATA ? [
  {
    id: 'g1', type: 'group', name: 'All Departments', dept: 'All',
    members: ['sa','ali','sara','fatima','omar'], unread: 2, muted: false,
    messages: [
      { id:'m1', from:'ali',    text:'Machine installation update: Crusher Unit A is now fully operational ✅', time: new Date(T - 90*60000).toISOString(),  file: null },
      { id:'m2', from:'fatima', text:'3 new hires onboarded today. Orientation session starts tomorrow morning.', time: new Date(T - 75*60000).toISOString(), file: null },
      { id:'m3', from:'sa',     text:'Great progress team! Keep the activity logs updated on the dashboard.', time: new Date(T - 70*60000).toISOString(),    file: null },
      { id:'m4', from:'sara',   text:'Ministry requested additional documents for eligibility. Working on it.', time: new Date(T - 20*60000).toISOString(),   file: null },
    ],
  },
  {
    id: 'g2', type: 'group', name: 'Production Team', dept: 'Production',
    members: ['sa','ali','omar'], unread: 1, muted: false,
    messages: [
      { id:'m5', from:'ali',  text:"Conveyor belt is stuck in customs — Almaty port.",                        time: new Date(T - 26*3600000).toISOString(), file: null },
      { id:'m6', from:'sa',   text:"Escalate immediately. I'll contact the logistics agent today.",           time: new Date(T - 25*3600000).toISOString(), file: null },
      { id:'m7', from:'omar', text:"Here's the customs clearance document they're requesting",                time: new Date(T - 24*3600000).toISOString(), file: { name:'customs_clearance.pdf', size:'245 KB', ext:'pdf' } },
    ],
  },
  {
    id: 'd1', type: 'direct', name: 'Ali Hassan', otherId: 'ali',
    unread: 0, muted: false,
    messages: [
      { id:'m8',  from:'sa',  text:'Ali, how is the installation progress on the conveyor belt?',                    time: new Date(T - 4*3600000).toISOString(),   file: null },
      { id:'m9',  from:'ali', text:"It's delayed due to customs. I've filed the paperwork. Should arrive in ~10 days.", time: new Date(T - 3.9*3600000).toISOString(), file: null },
      { id:'m10', from:'ali', text:"I'll send you the updated logistics report",                                      time: new Date(T - 3.8*3600000).toISOString(), file: { name:'logistics_report_apr.docx', size:'128 KB', ext:'docx' } },
    ],
  },
  {
    id: 'd2', type: 'direct', name: 'Sara Ahmed', otherId: 'sara',
    unread: 2, muted: false,
    messages: [
      { id:'m11', from:'sara', text:'The eligibility criteria approval is taking longer than expected.',         time: new Date(T - 3*3600000).toISOString(),   file: null },
      { id:'m12', from:'sara', text:"I've attached the ministry correspondence for your review.",                time: new Date(T - 2.9*3600000).toISOString(), file: { name:'ministry_letter_apr10.pdf', size:'312 KB', ext:'pdf' } },
    ],
  },
  {
    id: 'd3', type: 'direct', name: 'Fatima Noor', otherId: 'fatima',
    unread: 0, muted: false,
    messages: [
      { id:'m13', from:'fatima', text:'HR update: Visa for 2 foreign specialists is still pending.',   time: new Date(T - 28*3600000).toISOString(), file: null },
      { id:'m14', from:'sa',     text:'Keep following up. We need them on site by June.',              time: new Date(T - 27.5*3600000).toISOString(), file: null },
    ],
  },
  {
    id: 'd4', type: 'direct', name: 'Mr. Investor', otherId: 'investor',
    unread: 0, muted: true,
    messages: [
      { id:'m15', from:'investor', text:'Can you share the latest project health report?',                              time: new Date(T - 3*86400000).toISOString(), file: null },
      { id:'m16', from:'sa',       text:"Of course — dashboard access has been updated. You can view all reports.",     time: new Date(T - 3*86400000 + 600000).toISOString(), file: null },
    ],
  },
] : []

const AUTO_REPLIES = [
  "Got it, thanks! I'll update the dashboard shortly.",
  "Understood. Will confirm and keep you posted.",
  "On it! Will send you the details by end of day.",
  "Thanks for the heads up. Looking into it now.",
  "Confirmed — will action this now.",
  "Received. Let me check with the team and get back to you.",
]

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function msgTime(iso) {
  const d    = new Date(iso)
  const diff = (Date.now() - d) / 86400000
  if (diff < 1) return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  if (diff < 2) return 'Yesterday'
  if (diff < 7) return d.toLocaleDateString([], { weekday:'short' })
  return d.toLocaleDateString([], { day:'numeric', month:'short' })
}

function getUser(id) {
  const seeded = SEED_USERS.find((u) => u.id === id)
  if (seeded) return seeded
  if (String(id).startsWith('name:')) {
    const slug = String(id).slice(5)
    const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim() || 'Team member'
    const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'TM'
    return { id, name, dept: '', color: '#64748b', initials }
  }
  return { id: String(id), name: 'Team member', dept: '', color: '#64748b', initials: 'TM' }
}

// ─────────────────────────────────────────────────────────
// SVG ICONS
// ─────────────────────────────────────────────────────────
const IconSearch   = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
const IconEdit     = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
const IconPlus     = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
const IconVideo    = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m15 10 4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
const IconPhone    = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.13 1.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
const IconDots     = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
const IconAttach   = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
const IconSend     = () => <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
const IconLock     = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>

// ─────────────────────────────────────────────────────────
// FILE CARD
// ─────────────────────────────────────────────────────────
function FileCard({ file, isMe }) {
  const cfgs = {
    pdf:  { icon:'📄', bg:'rgba(239,68,68,0.18)',   color:'#ef4444' },
    docx: { icon:'📝', bg:'rgba(96,165,250,0.18)',  color:'#60a5fa' },
    doc:  { icon:'📝', bg:'rgba(96,165,250,0.18)',  color:'#60a5fa' },
    img:  { icon:'🖼️', bg:'rgba(34,197,94,0.18)',   color:'#22c55e' },
    xlsx: { icon:'📊', bg:'rgba(251,191,36,0.18)',  color:'#fbbf24' },
  }
  const cf = cfgs[file.ext?.toLowerCase()] || { icon:'📎', bg:'rgba(148,163,184,0.18)', color:'#94a3b8' }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6, background:'#f0f2f5', border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', cursor:'pointer' }}>
      <div style={{ width:36, height:36, borderRadius:8, background:cf.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{cf.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'#1c2a33', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{file.name}</div>
        <div style={{ fontSize:10, color:'#334155', marginTop:2 }}>{file.size}</div>
      </div>
        <div style={{ fontSize:16, color:'#334155', flexShrink:0 }}>⬇️</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// TYPING DOTS
// ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display:'flex', gap:3 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:'#334155', animation:'chatBounce 1.2s infinite', animationDelay:`${i*0.2}s` }} />
      ))}
      <style>{`@keyframes chatBounce{0%,60%,100%{opacity:.25;transform:scale(1)}30%{opacity:1;transform:scale(1.35)}}`}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// ICON BUTTON
// ─────────────────────────────────────────────────────────
function IBtn({ onClick, title, children, style = {} }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width:32, height:32, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color: hover ? '#ffffff' : '#334155', background: hover ? C.accent : 'rgba(0,104,74,0.08)', transition:'all .15s', ...style }}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────
function ChatTab({ onUnreadChange, onBack }) {
  const { user, token }  = useAuth()
  const perms     = usePermissions()
  const { t } = useLanguage()

  const [chats,         setChats]         = useState(INITIAL_CHATS)
  const [activeChatId,  setActiveChatId]  = useState(null)
  const [search,        setSearch]        = useState('')
  const [msgText,       setMsgText]       = useState('')
  const [showAttach,    setShowAttach]    = useState(false)
  const [showGroupModal,setShowGroupModal]= useState(false)
  const [typingChatId,  setTypingChatId]  = useState(null)
  const [toast,         setToast]         = useState(null)
  const [groupForm,     setGroupForm]     = useState({ name:'', dept:'', members:[] })
  const [participants,  setParticipants]  = useState([])

  const messagesEndRef   = useRef(null)
  const inputRef         = useRef(null)
  const activeChatIdRef  = useRef(activeChatId)
  const latestSeenRef    = useRef('')
  const participantsRef  = useRef([])
  useEffect(() => { activeChatIdRef.current = activeChatId }, [activeChatId])
  useEffect(() => { participantsRef.current = participants }, [participants])

  // unread badge for sidebar
  useEffect(() => {
    const n = chats.reduce((s,c) => s + (c.muted ? 0 : c.unread), 0)
    onUnreadChange?.(n)
  }, [chats])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [activeChatId, chats])
  useEffect(() => { if (activeChatId) setTimeout(() => inputRef.current?.focus(), 60) }, [activeChatId])

  const myAuthId = String(user?._id || user?.id || 'me')

  const myId = USE_SEED_DATA
    ? (() => {
        if (perms.isSuperAdmin) return 'sa'
        if (perms.isManagement) return 'investor'
        if (perms.isDepartmentHead) {
          const d = user?.department
          if (d === 'production') return 'ali'
          if (d === 'government') return 'sara'
          if (d === 'hr') return 'fatima'
          return 'ali'
        }
        return 'omar'
      })()
    : myAuthId

  const senderToSeedId = (senderName = '') => {
    const byName = SEED_USERS.find((u) => u.name.toLowerCase() === String(senderName).toLowerCase())
    if (byName) return byName.id
    if ((user?.name || '').toLowerCase() === String(senderName).toLowerCase()) return myId
    if (USE_SEED_DATA) return 'sa'
    return senderKeyFromName(senderName)
  }

  const initialsFor = (name = '') => {
    const initials = String(name || 'User')
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    return initials || 'U'
  }

  const participantColor = (id = '') => {
    const palette = ['#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#2563eb', '#059669']
    const sum = String(id || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    return palette[sum % palette.length]
  }

  const participantToUser = (row) => {
    const name = row?.fullName || row?.name || row?.email || 'Team member'
    return {
      id: String(row?._id || row?.id || name),
      name,
      email: row?.email || '',
      dept: row?.department || row?.role || '',
      title: row?.title || row?.role || '',
      employeeCode: row?.employeeCode || '',
      color: participantColor(row?._id || name),
      initials: initialsFor(name),
    }
  }

  const displayUser = (idOrName) => {
    const key = String(idOrName || '')
    const found = participantsRef.current.find((p) => (
      String(p._id) === key
      || String(p.id) === key
      || String(p.name || '').toLowerCase() === key.toLowerCase()
      || String(p.fullName || '').toLowerCase() === key.toLowerCase()
      || String(p.email || '').toLowerCase() === key.toLowerCase()
    ))
    return found ? participantToUser(found) : getUser(idOrName)
  }

  const mentionKeysFor = (person) => Array.from(new Set([
    person?.name,
    person?.fullName,
    person?.employeeCode,
    person?.email,
    String(person?.name || '').split(/\s+/)[0],
    String(person?.fullName || '').split(/\s+/)[0],
  ]
    .map((value) => String(value || '').trim().replace(/^@/, '').toLowerCase())
    .filter(Boolean)))

  const extractMentionParticipants = (text) => {
    const handles = Array.from(new Set(
      Array.from(String(text || '').matchAll(/@([A-Za-z0-9._-]+)/g))
        .map((match) => String(match[1] || '').trim().toLowerCase())
        .filter(Boolean)
    ))
    if (!handles.length) return []
    return participantsRef.current.filter((person) => {
      const keys = mentionKeysFor(person)
      return handles.some((handle) => keys.includes(handle))
    })
  }

  useEffect(() => {
    if (!token) return
    messagesAPI.getParticipants(token)
      .then((data) => setParticipants(Array.isArray(data.users) ? data.users : []))
      .catch(() => setParticipants([]))
  }, [token])

  useEffect(() => {
    if (!participants.length) return
    setChats((prev) => {
      const existing = new Set(prev.map((chat) => chat.id))
      const directShells = participants
        .map(participantToUser)
        .filter((person) => person.id && person.id !== myAuthId && person.id !== myId && !existing.has(`d:${person.id}`))
        .map((person) => ({
          id: `d:${person.id}`,
          type: 'direct',
          name: person.name,
          otherId: person.id,
          unread: 0,
          muted: false,
          messages: [],
        }))
      return directShells.length ? [...prev, ...directShells] : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.length])

  async function loadLatestFromApi(showIncomingToast = false) {
    if (!token) return
    try {
      const data = await messagesAPI.getLatestMessages(token, 'all', 100)
      const messages = (data.messages || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      const latestId = messages[messages.length - 1]?._id || ''
      const hasNew = latestSeenRef.current && latestSeenRef.current !== latestId
      if (latestId) latestSeenRef.current = latestId

      setChats((prev) => {
        const byId = new Map()
        const ensureChat = (chat) => {
          if (!byId.has(chat.id)) byId.set(chat.id, { ...chat, messages: chat.messages || [] })
          return byId.get(chat.id)
        }

        prev.forEach((chat) => {
          if (chat.messages?.length) return
          ensureChat(chat)
        })

        participantsRef.current.forEach((person) => {
          const id = String(person._id || person.id || '')
          if (!id || id === myAuthId) return
          const p = participantToUser(person)
          ensureChat({ id: `d:${id}`, type: 'direct', name: p.name, otherId: id, unread: 0, muted: false, messages: [] })
        })

        messages.forEach((m) => {
          const senderId = String(m.senderId || senderToSeedId(m.senderName))
          const recipientIds = Array.isArray(m.recipientIds) ? m.recipientIds.map(String) : []
          const isDirect = m.type === 'dm'
          const otherId = isDirect
            ? (senderId === myAuthId ? (recipientIds.find((id) => id !== myAuthId) || String(m.recipientNames?.[0] || 'direct')) : senderId)
            : ''
          const chatId = isDirect ? `d:${otherId}` : `g:${m.room || m.department || 'Team'}`
          const other = isDirect ? displayUser(otherId) : null
          const chat = ensureChat({
            id: chatId,
            type: isDirect ? 'direct' : 'group',
            name: isDirect ? (other?.name || String(m.recipientNames?.[0] || 'Direct Message')) : (m.room || 'Team'),
            dept: m.department || 'All',
            otherId,
            members: Array.from(new Set([senderId, ...recipientIds].filter(Boolean))),
            unread: 0,
            muted: false,
            messages: [],
          })
          if (!chat.members) chat.members = []
          chat.members = Array.from(new Set([...chat.members, senderId, ...recipientIds].filter(Boolean)))
          if (!chat.messages.some((row) => row.id === String(m._id))) {
            chat.messages.push({
              id: String(m._id),
              from: senderId,
              text: m.text,
              time: m.createdAt,
              file: null,
            })
          }
        })

        return Array.from(byId.values()).sort((a, b) => {
          const at = new Date(a.messages[a.messages.length - 1]?.time || 0).getTime()
          const bt = new Date(b.messages[b.messages.length - 1]?.time || 0).getTime()
          return bt - at
        })
      })

      if (showIncomingToast && hasNew) {
        const m = messages[messages.length - 1]
        const sender = displayUser(m.senderId || senderToSeedId(m.senderName))
        showToast(`New message from ${sender?.name || 'Team'}`, m.text || 'New message', sender?.color || C.accent)
      }
    } catch {
      // Keep local fallback if API is unavailable.
    }
  }

  useEffect(() => {
    if (!token) return
    loadLatestFromApi(false)

    const source = new EventSource(REALTIME_URL, { withCredentials: true })
    const onMessageCreated = () => { loadLatestFromApi(true) }

    source.addEventListener('message.created', onMessageCreated)

    const fallbackId = window.setInterval(() => { loadLatestFromApi(false) }, 60000)

    return () => {
      source.removeEventListener('message.created', onMessageCreated)
      source.close()
      window.clearInterval(fallbackId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const canCreateGroup = perms.isSuperAdmin || perms.isDepartmentHead
  const activeChat     = chats.find(c => c.id === activeChatId)
  const totalUnread    = chats.reduce((s,c) => s + (c.muted ? 0 : c.unread), 0)

  function openChat(id) {
    setActiveChatId(id)
    setMsgText('')
    setChats(prev => prev.map(c => c.id === id ? { ...c, unread:0 } : c))
  }

  function showToast(title, text, color = C.accent) {
    setToast({ title, text, color })
    setTimeout(() => setToast(null), 3200)
  }

  async function sendMessage(chatId) {
    const text = msgText.trim()
    if (!text || !chatId) return
    const newMsg = { id:`m${Date.now()}`, from:myId, text, time:new Date().toISOString(), file:null }
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages:[...c.messages, newMsg] } : c))
    setMsgText('')
    const currentChat = chats.find(c => c.id === chatId)
    const mentioned = extractMentionParticipants(text)
    const mentionedIds = mentioned.map((person) => String(person._id || person.id)).filter(Boolean)
    const chatRecipientIds = currentChat?.type === 'direct'
      ? [currentChat?.otherId].filter(Boolean)
      : (currentChat?.members || []).filter((id) => String(id) !== myAuthId)
    const recipientIds = Array.from(new Set([...chatRecipientIds, ...mentionedIds].filter(Boolean)))
    try {
      const saved = await messagesAPI.createMessage(token, {
        type: currentChat?.type === 'direct' ? 'dm' : 'group',
        room: currentChat?.name || 'All Departments',
        text,
        department: currentChat?.dept || user?.department || '',
        recipientIds,
        recipientNames: currentChat?.type === 'direct' ? [currentChat?.name].filter(Boolean) : [],
        mentionedUserIds: mentionedIds,
        mentionedNames: mentioned.map((person) => person.name || person.fullName).filter(Boolean),
      })
      if (saved?.message?._id) {
        setChats(prev => prev.map(c => c.id === chatId ? {
          ...c,
          messages: c.messages.map(m => m.id === newMsg.id ? { ...m, id: String(saved.message._id), time: saved.message.createdAt || m.time } : m),
        } : c))
      }
      if (mentionedIds.length) {
        showToast('Mention sent', `Delivered to ${mentioned.length} mentioned user${mentioned.length === 1 ? '' : 's'}.`)
      }
    } catch {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.filter(m => m.id !== newMsg.id) } : c))
      showToast('Send failed', 'Message could not be delivered. Please try again.', '#DC2626')
    }
    if (!USE_SEED_DATA) return
    const chat = chats.find(c => c.id === chatId)
    if (chat?.type !== 'direct') return
    const otherId = chat.otherId
    const other   = displayUser(otherId)
    setTypingChatId(chatId)
    const delay = 1200 + Math.random() * 900
    setTimeout(() => {
      setTypingChatId(null)
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)]
      const replyMsg = { id:`m${Date.now()}r`, from:otherId, text:reply, time:new Date().toISOString(), file:null }
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c
        const isActive = activeChatIdRef.current === chatId
        return { ...c, messages:[...c.messages, replyMsg], unread: isActive ? 0 : c.unread + 1 }
      }))
      if (activeChatIdRef.current !== chatId) {
        showToast('💬 ' + (other?.name || chat.name), reply, other?.color)
      }
    }, delay)
  }

  function sendFile(type) {
    setShowAttach(false)
    if (!activeChatId) return
    if (!USE_SEED_DATA) {
      showToast('Attachments', 'File attachments use real storage in production; demo files are disabled.')
      return
    }
    const files = {
      PDF:  { name:'project_report.pdf',   size:'312 KB', ext:'pdf'  },
      DOC:  { name:'status_update.docx',   size:'128 KB', ext:'docx' },
      IMG:  { name:'site_photo.jpg',        size:'2.4 MB', ext:'img'  },
      XLSX: { name:'data_export.xlsx',      size:'89 KB',  ext:'xlsx' },
    }
    const f = files[type]
    const newMsg = { id:`m${Date.now()}`, from:myId, text:'', time:new Date().toISOString(), file:f }
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages:[...c.messages, newMsg] } : c))
    showToast('📎 File Sent', f.name + ' uploaded successfully')
  }

  function createGroup() {
    if (!groupForm.name.trim()) return
    const members = [...new Set([myId, ...groupForm.members])]
    const g = { id:`g${Date.now()}`, type:'group', name:groupForm.name.trim(), dept:groupForm.dept, members, unread:0, muted:false, messages:[] }
    setChats(prev => [g, ...prev])
    setGroupForm({ name:'', dept:'', members:[] })
    setShowGroupModal(false)
    setTimeout(() => openChat(g.id), 80)
    showToast('✅ Group Created', g.name + ' is ready to use')
  }

  const q            = search.toLowerCase()
  const filtered     = chats.filter(c => c.name.toLowerCase().includes(q))
  const groupChats   = filtered.filter(c => c.type === 'group')
  const directChats  = filtered.filter(c => c.type === 'direct')

  // ─── RENDER ───────────────────────────────────────────
  return (
    <div style={{ display:'flex', height:'calc(100vh - 68px)', margin:'-24px', fontFamily:"'Inter', sans-serif" }}>

      {/* ═══════════ SIDEBAR ═══════════ */}
      <div style={{ width:350, padding:30, flexShrink:0, display:'flex', flexDirection:'column', background:C.sidebar, borderRight:`1px solid ${C.border}` }}>

        {/* Top */}
        <div style={{ padding:'16px 16px 12px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
              {onBack && (
                <button
                  onClick={onBack}
                  title="Back to Dashboard"
                  style={{ background: 'none', border: '1px solid #CBD5E1', borderRadius: '0.4rem', padding: '0.2rem 0.3rem', cursor: 'pointer', fontSize: '1rem', color: '#374151', display: 'flex', alignItems: 'center', fontFamily: 'inherit', lineHeight: 1 }}
                >←</button>
              )}
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:'#1c2a33', letterSpacing:'-0.3px' }}>💬 {t('chat')}</div>
                <div style={{ fontSize:11, color:'#334155', marginTop:2 }}>
                  {new Date().toLocaleDateString('en-US',{ weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <IBtn title="New message" onClick={() => showToast('✏️ New Message','Select a contact to start a direct message')}><IconEdit /></IBtn>
              {canCreateGroup ? (
                <IBtn title="Create group" onClick={() => setShowGroupModal(true)} style={{ background:C.accent, color:'#fff' }}><IconPlus /></IBtn>
              ) : (
                <IBtn title="Group creation restricted" style={{ opacity:0.4, cursor:'not-allowed' }}><IconLock /></IBtn>
              )}
            </div>
          </div>

          {/* Search */}
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#334155', display:'flex' }}><IconSearch /></div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchChats')}
              style={{ width:'100%', background:'#f8f9fa', border:'1.5px solid rgba(var(--purple-rgb),0.2)', borderRadius:10, padding:'9px 12px 9px 36px', fontSize:13, color:'#1c2a33', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e  => e.target.style.borderColor = 'rgba(0,104,74,0.2)'}
            />
          </div>
        </div>

        {/* Create group CTA */}
        {canCreateGroup ? (
          <div
            onClick={() => setShowGroupModal(true)}
            style={{ margin:'4px 14px 6px', padding:'10px 14px', borderRadius:10, background:'rgba(0,104,74,0.12)', border:'1.5px dashed rgba(0,104,74,0.35)', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(0,104,74,0.2)'; e.currentTarget.style.borderColor='rgba(0,104,74,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(0,104,74,0.12)'; e.currentTarget.style.borderColor='rgba(0,104,74,0.35)' }}
          >
            <div style={{ width:28, height:28, borderRadius:8, background:C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#fff', flexShrink:0, fontWeight:700 }}>+</div>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.accent }}>{t('createNewGroup')}</div>
              <div style={{ fontSize:10, color:'rgba(0,104,74,0.6)', marginTop:1 }}>Admin &amp; Dept Heads only</div>
            </div>
          </div>
        ) : (
          <div style={{ margin:'4px 14px 6px', padding:'8px 12px', borderRadius:8, background:'rgba(0,104,74,0.04)', border:`1px solid ${C.border}`, fontSize:11, color:'#334155', display:'flex', gap:6, alignItems:'center' }}>
            <IconLock /> Group creation — Admin / Head only
          </div>
        )}

        {/* Chat list */}
        <div style={{ flex:1, overflowY:'auto', scrollbarWidth:'thin', scrollbarColor:`rgba(0,104,74,0.3) transparent` }}>

          {/* Groups */}
          {groupChats.length > 0 && (
            <>
              <div style={{ padding:'10px 16px 5px', fontSize:10, fontWeight:700, color:'#334155', letterSpacing:'0.1em', textTransform:'uppercase' }}>{t('groups')}</div>
              {groupChats.map(chat => {
                const last   = chat.messages[chat.messages.length - 1]
                const sender = last ? displayUser(last.from) : null
                const active = activeChatId === chat.id
                return (
                  <div
                    key={chat.id}
                    onClick={() => openChat(chat.id)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', cursor:'pointer', borderLeft:`3px solid ${active ? C.accent : 'transparent'}`, background: active ? C.sidebarActive : 'transparent', transition:'all .15s' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.sidebarHover }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(0,104,74,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>👥</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'#1c2a33' }}>{chat.name}</span>
                          <span style={{ fontSize:9, background:'rgba(var(--purple-rgb),0.1)', color:'var(--purple)', padding:'2px 6px', borderRadius:5, fontWeight:600 }}>Group</span>
                        </div>
                        <span style={{ fontSize:10, color:'#334155', flexShrink:0 }}>{last ? msgTime(last.time) : ''}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:11.5, color: chat.unread ? '#374151' : '#334155', fontWeight: chat.unread ? 500 : 400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>
                          {last ? (sender?.name ? sender.name + ': ' : '') + (last.file ? '📎 File' : last.text.substring(0,32)) : 'No messages yet'}
                        </span>
                        {chat.unread > 0 && (
                          <span style={{ background: chat.muted ? '#94a3b8' : C.accent, color:'#fff', fontSize:10, fontWeight:700, minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', flexShrink:0, marginLeft:4 }}>
                            {chat.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Direct Messages */}
          {directChats.length > 0 && (
            <>
              <div style={{ padding:'10px 16px 5px', fontSize:10, fontWeight:700, color:'#334155', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:6 }}>{t('directMessages')}</div>
              {directChats.map(chat => {
                const other  = displayUser(chat.otherId)
                const last   = chat.messages[chat.messages.length - 1]
                const active = activeChatId === chat.id
                return (
                  <div
                    key={chat.id}
                    onClick={() => openChat(chat.id)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', cursor:'pointer', borderLeft:`3px solid ${active ? C.accent : 'transparent'}`, background: active ? C.sidebarActive : 'transparent', transition:'all .15s' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.sidebarHover }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <div style={{ width:42, height:42, borderRadius:'50%', background:(other?.color || '#334155') + '20', color: other?.color || '#475569', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 }}>
                        {other?.initials || '?'}
                      </div>
                      <div style={{ position:'absolute', bottom:1, right:1, width:11, height:11, borderRadius:'50%', background:'#22c55e', border:`2.5px solid #ffffff` }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'#1c2a33' }}>{chat.name}</span>
                        <span style={{ fontSize:10, color:'#334155', flexShrink:0 }}>{last ? msgTime(last.time) : ''}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:11.5, color: chat.unread ? '#374151' : '#334155', fontWeight: chat.unread ? 500 : 400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>
                          {last ? (last.file ? '📎 File' : last.text.substring(0,32)) : 'Start a conversation'}
                        </span>
                        {chat.unread > 0 && !chat.muted && (
                          <span style={{ background:C.accent, color:'#fff', fontSize:10, fontWeight:700, minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', flexShrink:0, marginLeft:4 }}>
                            {chat.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 16px', fontSize:13, color:'#334155' }}>{t('noChatsFound')}</div>
          )}
        </div>
      </div>

      {/* ═══════════ MAIN PANEL ═══════════ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:C.main, minWidth:0 }}>

        {!activeChat ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, color:'#334155' }}>
            <div style={{ fontSize:52, opacity:.2 }}>💬</div>
            <div style={{ fontSize:14, fontWeight:600 }}>{t('selectConversation')}</div>
            <div style={{ fontSize:12, opacity:.6 }}>{t('chooseFromList')}</div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div style={{ padding:'30px 20px', background:C.sidebar, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
              {activeChat.type === 'group' ? (
                <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(0,104,74,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>👥</div>
              ) : (
                <div style={{ position:'relative', flexShrink:0 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:(displayUser(activeChat.otherId)?.color || '#334155') + '20', color: displayUser(activeChat.otherId)?.color || '#475569', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 }}>
                    {displayUser(activeChat.otherId)?.initials || '?'}
                  </div>
                  <div style={{ position:'absolute', bottom:0, right:0, width:11, height:11, borderRadius:'50%', background:'#22c55e', border:`2.5px solid #ffffff` }} />
                </div>
              )}

              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'#1c2a33' }}>{activeChat.name}</div>
                <div style={{ fontSize:11, color:'#22c55e', marginTop:2, display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block' }} />
                  {activeChat.type === 'group' ? `${activeChat.members.length} members · Active` : 'Online now'}
                </div>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                {/* Video button */}
                <button
                  onClick={() => showToast('📹 Video Call', `Starting video call with ${activeChat.name}...`, '#60a5fa')}
                  style={{ padding:'7px 14px', borderRadius:8, border:`1.5px solid ${C.border}`, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, background:'#f8f9fa', color:'#374151', transition:'all .2s' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f0faf5'}
                  onMouseLeave={e => e.currentTarget.style.background='#f8f9fa'}
                >
                  <IconVideo /> Video
                </button>
                {/* Call button */}
                <button
                  onClick={() => showToast('📞 Voice Call', `Calling ${activeChat.name}...`, '#22c55e')}
                  style={{ padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, background:'#22c55e', color:'#fff', transition:'all .2s' }}
                  onMouseEnter={e => e.currentTarget.style.filter='brightness(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.filter='none'}
                >
                  <IconPhone /> Call
                </button>
                <IBtn title="Chat info" onClick={() => showToast('ℹ️ Chat Info','Members list and settings')}><IconDots /></IBtn>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', padding:'20px 18px', display:'flex', flexDirection:'column', gap:4, scrollbarWidth:'thin', scrollbarColor:`rgba(0,104,74,0.3) transparent` }}>
              <div style={{ alignSelf:'center', fontSize:11, fontWeight:600, color:'#334155', background:'#f0f2f5', padding:'4px 14px', borderRadius:20, marginBottom:8 }}>Today</div>

              {activeChat.messages.map((msg, idx) => {
                const isMe    = msg.from === myId
                const sender  = displayUser(msg.from)
                const prevMsg = activeChat.messages[idx - 1]
                const sameUser = prevMsg && prevMsg.from === msg.from
                const showAvatar = !isMe && !sameUser
                const showName   = !isMe && activeChat.type === 'group' && !sameUser

                return (
                  <div key={msg.id} style={{ display:'flex', alignItems:'flex-end', gap:9, marginBottom:2, flexDirection: isMe ? 'row-reverse' : 'row', marginTop: sameUser ? 2 : 12 }}>
                    {/* Avatar */}
                    <div style={{ width:30, height:30, flexShrink:0 }}>
                      {!isMe && showAvatar ? (
                        <div style={{ width:30, height:30, borderRadius:'50%', background:(sender?.color || '#334155') + '20', color: sender?.color || '#475569', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>
                          {sender?.initials || '?'}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ maxWidth:'62%', display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      {showName && (
                        <div style={{ fontSize:11, fontWeight:700, color: sender?.color || '#475569', marginBottom:4, marginLeft:2 }}>
                          {sender?.name}
                        </div>
                      )}
                      <div style={{
                        padding:'10px 14px',
                        borderRadius:16,
                        fontSize:13,
                        lineHeight:1.55,
                        color: isMe ? '#ffffff' : '#1c2a33',
                        wordBreak:'break-word',
                        background: isMe ? C.bubbleMe : C.bubbleIn,
                        borderBottomRightRadius: isMe ? 4 : 16,
                        borderBottomLeftRadius:  isMe ? 16 : 4,
                      }}>
                        {msg.text && <div>{msg.text}</div>}
                        {msg.file && <FileCard file={msg.file} isMe={isMe} />}
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                          <span style={{ fontSize:10, color: isMe ? 'rgba(255,255,255,0.55)' : '#334155' }}>{msgTime(msg.time)}</span>
                          {isMe && <span style={{ fontSize:12, color:'#60a5fa' }}>✓✓</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Typing indicator */}
              {typingChatId === activeChatId && (
                <div style={{ display:'flex', alignItems:'flex-end', gap:9, marginTop:12 }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', background:(displayUser(activeChat.otherId)?.color || '#334155') + '20', color: displayUser(activeChat.otherId)?.color || '#475569', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>
                    {displayUser(activeChat.otherId)?.initials || '?'}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 16px', borderRadius:16, borderBottomLeftRadius:4, background:C.bubbleIn, fontSize:11, color:'#334155' }}>
                    <TypingDots />
                    <span>{displayUser(activeChat.otherId)?.name} is typing…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div style={{ padding:'12px 16px', background:C.inputBg, borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>

                {/* Attach */}
                <div style={{ position:'relative' }}>
                  <IBtn title="Attach file" onClick={() => setShowAttach(a => !a)}><IconAttach /></IBtn>
                  {showAttach && (
                    <div style={{ position:'absolute', bottom:'calc(100% + 8px)', left:0, background:'#ffffff', border:`1px solid ${C.border}`, borderRadius:14, padding:10, display:'flex', gap:8, zIndex:20, boxShadow:'0 8px 24px rgba(0,0,0,0.12)' }}>
                      {[
                        { type:'PDF',  icon:'📄', label:'PDF',   bg:'rgba(239,68,68,0.18)'  },
                        { type:'DOC',  icon:'📝', label:'Word',  bg:'rgba(96,165,250,0.18)' },
                        { type:'IMG',  icon:'🖼️', label:'Photo', bg:'rgba(34,197,94,0.18)'  },
                        { type:'XLSX', icon:'📊', label:'File',  bg:'rgba(251,191,36,0.18)' },
                      ].map(opt => (
                        <button
                          key={opt.type}
                          onClick={() => sendFile(opt.type)}
                          style={{ width:58, height:58, borderRadius:12, border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, fontSize:10, fontWeight:600, color:'#fff', background:opt.bg, transition:'all .2s' }}
                          onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
                          onMouseLeave={e => e.currentTarget.style.transform='none'}
                        >
                          <span style={{ fontSize:20 }}>{opt.icon}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input box */}
                <div style={{ flex:1, display:'flex', alignItems:'center', background:'#f8f9fa', border:'1.5px solid rgba(0,104,74,0.2)', borderRadius:24, padding:'9px 16px', gap:8, transition:'border-color .2s' }}
                  onFocusCapture={e => e.currentTarget.style.borderColor = C.accent}
                  onBlurCapture={e  => e.currentTarget.style.borderColor = 'rgba(0,104,74,0.2)'}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(activeChatId))}
                    placeholder={t('typeMessage')}
                    style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:13, color:'#1c2a33', fontFamily:'inherit' }}
                  />
                  <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, opacity:.6 }} onClick={() => {}}>😊</button>
                </div>

                {/* Send */}
                <button
                  onClick={() => sendMessage(activeChatId)}
                  disabled={!msgText.trim()}
                  style={{ width:40, height:40, borderRadius:'50%', background: msgText.trim() ? C.accent : 'rgba(0,104,74,0.3)', border:'none', cursor: msgText.trim() ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', flexShrink:0 }}
                  onMouseEnter={e => { if (msgText.trim()) { e.currentTarget.style.background=C.accent2; e.currentTarget.style.transform='scale(1.06)' }}}
                  onMouseLeave={e => { e.currentTarget.style.background = msgText.trim() ? C.accent : 'rgba(0,104,74,0.3)'; e.currentTarget.style.transform='scale(1)' }}
                >
                  <IconSend />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══════════ CREATE GROUP MODAL ═══════════ */}
      {showGroupModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, backdropFilter:'blur(6px)' }}>
          <div style={{ background:'#ffffff', border:`1px solid ${C.border}`, borderRadius:18, padding:24, width:380, maxWidth:'92vw', boxShadow:'0 20px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <div style={{ fontSize:17, fontWeight:700, color:'#1c2a33' }}>{t('createNewGroup')}</div>
              <button onClick={() => setShowGroupModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#334155', fontSize:18 }}>✕</button>
            </div>
            <div style={{ fontSize:12, color:'#334155', marginBottom:18 }}>{t('groupCreationRestricted')}</div>

            <div style={{ marginBottom:12 }}>
              <input
                value={groupForm.name}
                onChange={e => setGroupForm(p => ({ ...p, name:e.target.value }))}
                placeholder="Group name e.g. Production Team"
                autoFocus
                style={{ width:'100%', background:'#f8f9fa', border:'1.5px solid rgba(var(--purple-rgb),0.2)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#1c2a33', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e  => e.target.style.borderColor = 'rgba(var(--purple-rgb),0.2)'}
              />
            </div>
            <div style={{ marginBottom:16 }}>
              <select
                value={groupForm.dept}
                onChange={e => setGroupForm(p => ({ ...p, dept:e.target.value }))}
                style={{ width:'100%', background:'#f8f9fa', border:'1.5px solid rgba(var(--purple-rgb),0.2)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#1c2a33', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e  => e.target.style.borderColor = 'rgba(var(--purple-rgb),0.2)'}
              >
                <option value="" style={{ background:'#ffffff' }}>{t('selectDepartmentScope')}</option>
                {['All Departments','Production & Factory','HR & Hiring','Finance & Accounts','Govt. & Compliance','Sales & Marketing','Operations & Logistics','Training & Dev.'].map(d => (
                  <option key={d} value={d} style={{ background:'#ffffff' }}>{d}</option>
                ))}
              </select>
            </div>

            <div style={{ fontSize:11, color:'#334155', fontWeight:600, marginBottom:8, letterSpacing:'0.05em', textTransform:'uppercase' }}>{t('addMembers')}</div>
            <div style={{ maxHeight:160, overflowY:'auto', marginBottom:18, scrollbarWidth:'thin', scrollbarColor:'rgba(0,104,74,0.3) transparent' }}>
              {(participants.length ? participants.map(participantToUser) : SEED_USERS).filter(u => u.id !== myId && u.id !== myAuthId).map(u => (
                <label key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', transition:'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(0,104,74,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  <input
                    type="checkbox"
                    checked={groupForm.members.includes(u.id)}
                    onChange={() => setGroupForm(p => ({ ...p, members: p.members.includes(u.id) ? p.members.filter(m => m !== u.id) : [...p.members, u.id] }))}
                    style={{ accentColor:C.accent, width:15, height:15, flexShrink:0 }}
                  />
                  <div style={{ width:30, height:30, borderRadius:'50%', background:u.color + '20', color:u.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{u.initials}</div>
                  <span style={{ flex:1, fontSize:13, color:'#1c2a33' }}>{u.name}</span>
                  <span style={{ fontSize:10, color:'#334155' }}>{u.dept}</span>
                </label>
              ))}
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => { setShowGroupModal(false); setGroupForm({ name:'', dept:'', members:[] }) }}
                style={{ flex:1, padding:10, borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'1px solid rgba(0,0,0,0.1)', background:'#f3f4f6', color:'#374151', transition:'all .2s' }}
                onMouseEnter={e => e.currentTarget.style.background='#e5e7eb'}
                onMouseLeave={e => e.currentTarget.style.background='#f3f4f6'}
              >
                {t('cancel')}
              </button>
              <button
                onClick={createGroup}
                disabled={!groupForm.name.trim()}
                style={{ flex:1, padding:10, borderRadius:10, fontSize:13, fontWeight:600, cursor: groupForm.name.trim() ? 'pointer' : 'not-allowed', fontFamily:'inherit', border:'none', background: groupForm.name.trim() ? C.accent : 'rgba(0,104,74,0.3)', color:'#fff', transition:'all .2s' }}
                onMouseEnter={e => { if (groupForm.name.trim()) e.currentTarget.style.background=C.accent2 }}
                onMouseLeave={e => { e.currentTarget.style.background = groupForm.name.trim() ? C.accent : 'rgba(0,104,74,0.3)' }}
              >
                {t('createGroup')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ TOAST ═══════════ */}
      {toast && (
        <div style={{ position:'fixed', top:14, right:14, minWidth:250, background:'#ffffff', border:`1px solid ${C.border}`, borderLeft:`3px solid ${toast.color || C.accent}`, borderRadius:12, padding:'12px 16px', zIndex:999, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', animation:'toastIn .3s ease' }}>
          <style>{`@keyframes toastIn{from{transform:translateX(16px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
          <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1c2a33', marginBottom:3 }}>{toast.title}</div>
              <div style={{ fontSize:12, color:'#334155' }}>{toast.text}</div>
            </div>
            <button onClick={() => setToast(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#334155', fontSize:16, lineHeight:1 }}>✕</button>
          </div>
        </div>
      )}

      {/* Click outside to close attach popup */}
      {showAttach && <div style={{ position:'fixed', inset:0, zIndex:10 }} onClick={() => setShowAttach(false)} />}
    </div>
  )
}

export default ChatTab
