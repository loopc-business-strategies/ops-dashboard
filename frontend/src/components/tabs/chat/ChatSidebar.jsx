import {
  C,
  msgTime,
  IconSearch,
  IconEdit,
  IconPlus,
  IconLock,
  IBtn,
} from './chatUi'

export default function ChatSidebar({
  onBack,
  t,
  canCreateGroup,
  showToast,
  setShowGroupModal,
  search,
  setSearch,
  groupChats,
  directChats,
  activeChatId,
  openChat,
  displayUser,
  isUserOnline,
}) {
  return (
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
                  style={{ width:'100%', background:'#f8f9fa', border:'1.5px solid rgba(var(--brand-rgb),0.2)', borderRadius:10, padding:'9px 12px 9px 36px', fontSize:13, color:'#1c2a33', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e  => e.target.style.borderColor = 'rgba(var(--brand-rgb),0.2)'}
                />
              </div>
            </div>

            {/* Create group CTA */}
            {canCreateGroup ? (
              <div
                onClick={() => setShowGroupModal(true)}
                style={{ margin:'4px 14px 6px', padding:'10px 14px', borderRadius:10, background:'rgba(var(--brand-rgb),0.12)', border:'1.5px dashed rgba(var(--brand-rgb),0.35)', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(var(--brand-rgb),0.2)'; e.currentTarget.style.borderColor='rgba(var(--brand-rgb),0.6)' }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(var(--brand-rgb),0.12)'; e.currentTarget.style.borderColor='rgba(var(--brand-rgb),0.35)' }}
              >
                <div style={{ width:28, height:28, borderRadius:8, background:C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#fff', flexShrink:0, fontWeight:700 }}>+</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.accent }}>{t('createNewGroup')}</div>
                  <div style={{ fontSize:10, color:'rgba(var(--brand-rgb),0.6)', marginTop:1 }}>Admin &amp; Dept Heads only</div>
                </div>
              </div>
            ) : (
              <div style={{ margin:'4px 14px 6px', padding:'8px 12px', borderRadius:8, background:'rgba(var(--brand-rgb),0.04)', border:`1px solid ${C.border}`, fontSize:11, color:'#334155', display:'flex', gap:6, alignItems:'center' }}>
                <IconLock /> Group creation — Admin / Head only
              </div>
            )}

            {/* Chat list */}
            <div style={{ flex:1, overflowY:'auto', scrollbarWidth:'thin', scrollbarColor:`rgba(var(--brand-rgb),0.3) transparent` }}>

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
                        <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(var(--brand-rgb),0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>👥</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <span style={{ fontSize:13, fontWeight:600, color:'#1c2a33' }}>{chat.name}</span>
                              <span style={{ fontSize:9, background:'rgba(var(--brand-rgb),0.1)', color:'var(--brand-primary)', padding:'2px 6px', borderRadius:5, fontWeight:600 }}>Group</span>
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
                    const otherOnline = isUserOnline(chat.otherId)
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
                          {otherOnline ? (
                            <div style={{ position:'absolute', bottom:1, right:1, width:11, height:11, borderRadius:'50%', background:'#22c55e', border:'2.5px solid #ffffff' }} />
                          ) : null}
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

              {groupChats.length === 0 && directChats.length === 0 && (
                <div style={{ textAlign:'center', padding:'40px 16px', fontSize:13, color:'#334155' }}>{t('noChatsFound')}</div>
              )}
            </div>
          </div>
  )
}
