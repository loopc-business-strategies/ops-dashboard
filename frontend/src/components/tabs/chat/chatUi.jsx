import { useState, useEffect } from 'react'

export const C = {
  sidebar:       '#ffffff',
  sidebarHover:  '#f0faf5',
  sidebarActive: '#e6f5ef',
  main:          '#f8f9fa',
  bubbleIn:      '#f0f2f5',
  bubbleMe:      'var(--brand-primary)',
  inputBg:       '#ffffff',
  border:        'rgba(var(--brand-rgb),0.12)',
  accent:        'var(--brand-primary)',
  accent2:       'var(--brand-primary)',
}

export function msgTime(iso) {
  const d    = new Date(iso)
  const diff = (Date.now() - d) / 86400000
  if (diff < 1) return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  if (diff < 2) return 'Yesterday'
  if (diff < 7) return d.toLocaleDateString([], { weekday:'short' })
  return d.toLocaleDateString([], { day:'numeric', month:'short' })
}

export const IconSearch   = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
export const IconEdit     = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
export const IconPlus     = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
export const IconVideo    = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m15 10 4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
export const IconPhone    = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.13 1.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
export const IconDots     = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
export const IconAttach   = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
export const IconSend     = () => <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
export const IconLock     = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>

export function FileCard({ file, isMe }) {
  const [previewSrc, setPreviewSrc] = useState(null)
  const [previewFailed, setPreviewFailed] = useState(false)

  useEffect(() => {
    if (!file.previewUrl) {
      setPreviewSrc(null)
      setPreviewFailed(false)
      return undefined
    }
    let cancelled = false
    let objectUrl = null
    setPreviewFailed(false)
    setPreviewSrc(null)
    ;(async () => {
      try {
        const res = await fetch(file.previewUrl, { credentials: 'include' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewSrc(objectUrl)
      } catch {
        if (!cancelled) setPreviewFailed(true)
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file.previewUrl])

  const cfgs = {
    pdf:  { icon:'📄', bg:'rgba(239,68,68,0.18)',   color:'#ef4444' },
    docx: { icon:'📝', bg:'rgba(96,165,250,0.18)',  color:'#60a5fa' },
    doc:  { icon:'📝', bg:'rgba(96,165,250,0.18)',  color:'#60a5fa' },
    img:  { icon:'🖼️', bg:'rgba(34,197,94,0.18)',   color:'#22c55e' },
    jpg:  { icon:'🖼️', bg:'rgba(34,197,94,0.18)',   color:'#22c55e' },
    jpeg: { icon:'🖼️', bg:'rgba(34,197,94,0.18)',   color:'#22c55e' },
    png:  { icon:'🖼️', bg:'rgba(34,197,94,0.18)',   color:'#22c55e' },
    webp: { icon:'🖼️', bg:'rgba(34,197,94,0.18)',   color:'#22c55e' },
    xlsx: { icon:'📊', bg:'rgba(251,191,36,0.18)',  color:'#fbbf24' },
  }
  const cf = cfgs[file.ext?.toLowerCase()] || { icon:'📎', bg:'rgba(148,163,184,0.18)', color:'#94a3b8' }
  const openFile = () => {
    if (!file.url) return
    void (async () => {
      try {
        const res = await fetch(file.url, { credentials: 'include' })
        if (!res.ok) throw new Error(String(res.status))
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        const child = window.open(objectUrl, '_blank', 'noopener,noreferrer')
        if (!child) {
          URL.revokeObjectURL(objectUrl)
          throw new Error('popup blocked')
        }
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120000)
      } catch {
        window.open(file.url, '_blank', 'noopener,noreferrer')
      }
    })()
  }
  const showImageThumb = Boolean(file.previewUrl && previewSrc && !previewFailed)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openFile}
      onKeyDown={(e) => { if (e.key === 'Enter') openFile() }}
      style={{ display:'flex', alignItems:'center', gap:10, marginTop:6, background:'#f0f2f5', border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', cursor: file.url ? 'pointer' : 'default' }}
    >
      {showImageThumb ? (
        <img src={previewSrc} alt={file.name} style={{ width:72, height:72, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
      ) : (
        <div style={{ width:36, height:36, borderRadius:8, background:cf.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{cf.icon}</div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color: isMe ? '#fff' : '#1c2a33', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{file.name}</div>
        <div style={{ fontSize:10, color: isMe ? 'rgba(255,255,255,0.75)' : '#334155', marginTop:2 }}>{file.size}</div>
      </div>
      {file.url ? <div style={{ fontSize:16, color: isMe ? 'rgba(255,255,255,0.85)' : '#334155', flexShrink:0 }}>⬇️</div> : null}
    </div>
  )
}


export function TypingDots() {
  return (
    <div style={{ display:'flex', gap:3 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:'#334155', animation:'chatBounce 1.2s infinite', animationDelay:`${i*0.2}s` }} />
      ))}
      <style>{`@keyframes chatBounce{0%,60%,100%{opacity:.25;transform:scale(1)}30%{opacity:1;transform:scale(1.35)}}`}</style>
    </div>
  )
}


export function IBtn({ onClick, title, children, style = {} }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width:32, height:32, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color: hover ? '#ffffff' : '#334155', background: hover ? C.accent : 'rgba(var(--brand-rgb),0.08)', transition:'all .15s', ...style }}
    >
      {children}
    </button>
  )
}

