import {
  C,
  msgTime,
  IconVideo,
  IconPhone,
  IconDots,
  IconAttach,
  IconSend,
  FileCard,
  TypingDots,
  IBtn,
} from './chatUi'
import {
  CHAT_TRANSLATE_LANGS,
  CHAT_TRANSLATE_SOURCE_LANGS,
  detectTextDirection,
  isRtlChatLang,
} from '../../../utils/chatTranslate'

export default function ChatThread({
  t,
  activeChat,
  activeChatId,
  activeDmOnline,
  activeGroupOnlineCount,
  displayUser,
  myId,
  showToast,
  msgText,
  setMsgText,
  sendMessage,
  triggerFilePick,
  fileInputRef,
  handleFileSelected,
  messagesEndRef,
  inputRef,
  typing,
  typingChatId,
  chatTranslateEnabled,
  translatePanelOpen,
  setTranslatePanelOpen,
  translateSourceLang,
  handleTranslateSourceChange,
  translateTargetLang,
  handleTranslateTargetChange,
  handleTranslateMessage,
  translateLoading,
  translatePreview,
  translateOriginal,
  handleUseTranslation,
  handleRevertTranslation,
  resetTranslateState,
  clearTranslateResult,
  composerTextDirection,
  originalTextDirection,
  previewTargetRtl,
}) {
  return (
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
                      {activeDmOnline ? (
                        <div style={{ position:'absolute', bottom:0, right:0, width:11, height:11, borderRadius:'50%', background:'#22c55e', border:'2.5px solid #ffffff' }} />
                      ) : null}
                    </div>
                  )}

                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1c2a33' }}>{activeChat.name}</div>
                    <div style={{ fontSize:11, color: activeChat.type === 'group' ? '#64748B' : (activeDmOnline ? '#22c55e' : '#94a3b8'), marginTop:2, display:'flex', alignItems:'center', gap:5 }}>
                      {activeChat.type === 'group' ? null : (
                        <div style={{ width:6, height:6, borderRadius:'50%', background: activeDmOnline ? '#22c55e' : '#94a3b8', display:'inline-block' }} />
                      )}
                      {activeChat.type === 'group'
                        ? `${activeChat.members.length} members · ${activeGroupOnlineCount} online`
                        : (activeDmOnline ? 'Online now' : 'Offline')}
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
                              {isMe && !msg.pending && <span style={{ fontSize:12, color:'#60a5fa' }}>✓✓</span>}
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
                  {chatTranslateEnabled && translatePanelOpen ? (
                    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:12, background:'#f0faf5', border:'1px solid rgba(0,104,74,0.18)', direction:'ltr', unicodeBidi:'isolate' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:10 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#0f766e' }}>{t('chatTranslatePreview')}</span>
                        <button
                          type="button"
                          onClick={resetTranslateState}
                          aria-label={t('chatTranslateClose')}
                          title={t('chatTranslateClose')}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', fontSize:16, lineHeight:1, padding:2 }}
                        >
                          ×
                        </button>
                      </div>

                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                        <select
                          value={translateSourceLang}
                          onChange={(e) => handleTranslateSourceChange(e.target.value)}
                          aria-label={t('chatTranslateSourceLang')}
                          style={{ height:34, borderRadius:999, border:'1px solid rgba(0,104,74,0.25)', background:'#fff', color:'#334155', fontSize:12, padding:'0 10px', maxWidth:130 }}
                        >
                          {CHAT_TRANSLATE_SOURCE_LANGS.map((lang) => (
                            <option key={lang.code} value={lang.code}>{t(lang.labelKey)}</option>
                          ))}
                        </select>
                        <select
                          value={translateTargetLang}
                          onChange={(e) => handleTranslateTargetChange(e.target.value)}
                          aria-label={t('chatTranslateTargetLang')}
                          style={{ height:34, borderRadius:999, border:'1px solid rgba(0,104,74,0.25)', background:'#fff', color:'#334155', fontSize:12, padding:'0 10px' }}
                        >
                          {CHAT_TRANSLATE_LANGS.map((lang) => (
                            <option key={lang.code} value={lang.code}>{t(lang.labelKey)}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleTranslateMessage}
                          disabled={!msgText.trim() || translateLoading}
                          title={t('chatTranslateAction')}
                          style={{
                            height:34,
                            padding:'0 12px',
                            borderRadius:999,
                            border:'1px solid rgba(0,104,74,0.25)',
                            background: msgText.trim() && !translateLoading ? '#ecfdf5' : '#f8fafc',
                            color:'#0f766e',
                            fontSize:12,
                            fontWeight:700,
                            cursor: msgText.trim() && !translateLoading ? 'pointer' : 'not-allowed',
                            whiteSpace:'nowrap',
                          }}
                        >
                          {translateLoading ? t('chatTranslateLoading') : t('chatTranslateAction')}
                        </button>
                      </div>

                      {translateOriginal || translatePreview ? (
                        <>
                          <div style={{ marginBottom:8 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#64748b', marginBottom:4 }}>{t('chatTranslateOriginal')}</div>
                            <div
                              dir={originalTextDirection}
                              style={{
                                padding:'8px 10px',
                                borderRadius:10,
                                border:'1px solid rgba(0,104,74,0.12)',
                                background:'#f8fafc',
                                fontSize:12,
                                lineHeight:1.5,
                                color:'#475569',
                                textAlign: originalTextDirection === 'rtl' ? 'right' : 'left',
                                wordBreak:'break-word',
                                minHeight:36,
                              }}
                            >
                              {translateOriginal || msgText}
                            </div>
                          </div>
                          <div style={{ marginBottom:8 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#0f766e', marginBottom:4 }}>{t('chatTranslateResult')}</div>
                            <textarea
                              value={translatePreview}
                              onChange={(e) => setTranslatePreview(e.target.value.slice(0, 4000))}
                              dir={previewTargetRtl ? 'rtl' : 'ltr'}
                              rows={2}
                              placeholder={t('chatTranslateResult')}
                              style={{
                                width:'100%',
                                boxSizing:'border-box',
                                resize:'vertical',
                                minHeight:52,
                                border:'1px solid rgba(0,104,74,0.2)',
                                borderRadius:10,
                                padding:'8px 10px',
                                fontSize:13,
                                lineHeight:1.5,
                                fontFamily:'inherit',
                                color:'#1c2a33',
                                background:'#ffffff',
                                textAlign: previewTargetRtl ? 'right' : 'left',
                                unicodeBidi:'plaintext',
                              }}
                            />
                          </div>
                          <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                            <button
                              type="button"
                              onClick={handleUseTranslation}
                              disabled={!translatePreview.trim()}
                              style={{ padding:'6px 12px', borderRadius:999, border:'none', background:C.accent, color:'#fff', fontSize:12, fontWeight:700, cursor: translatePreview.trim() ? 'pointer' : 'not-allowed' }}
                            >
                              {t('chatTranslateUse')}
                            </button>
                            <button
                              type="button"
                              onClick={handleRevertTranslation}
                              style={{ padding:'6px 12px', borderRadius:999, border:'1px solid rgba(0,104,74,0.25)', background:'#fff', color:'#334155', fontSize:12, fontWeight:600, cursor:'pointer' }}
                            >
                              {t('chatTranslateRevert')}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>

                    {/* Attach */}
                    <div style={{ position:'relative' }}>
                      <IBtn title="Attach file" onClick={triggerFilePick}><IconAttach /></IBtn>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.txt,.wav,.mp3,.m4a,.webm"
                        style={{ display:'none' }}
                        onChange={handleFileSelected}
                      />
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
                        dir={composerTextDirection}
                        style={{
                          flex:1,
                          background:'none',
                          border:'none',
                          outline:'none',
                          fontSize:13,
                          color:'#1c2a33',
                          fontFamily:'inherit',
                          textAlign: composerTextDirection === 'rtl' ? 'right' : 'left',
                          unicodeBidi:'plaintext',
                        }}
                      />
                      <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, opacity:.6 }} onClick={() => {}}>😊</button>
                    </div>

                    {chatTranslateEnabled ? (
                      <button
                        type="button"
                        onClick={() => setTranslatePanelOpen(true)}
                        title={t('chatTranslateAction')}
                        style={{
                          height:34,
                          padding:'0 12px',
                          borderRadius:999,
                          border:'1px solid rgba(0,104,74,0.25)',
                          background: translatePanelOpen ? '#ecfdf5' : '#fff',
                          color:'#0f766e',
                          fontSize:12,
                          fontWeight:700,
                          cursor:'pointer',
                          whiteSpace:'nowrap',
                          flexShrink:0,
                        }}
                      >
                        {t('chatTranslateAction')}
                      </button>
                    ) : null}

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
  )
}
