import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as salesAiApi from '../../api/salesAi'
import SalesMessageContent from './SalesMessageContent'

const DEFAULT_QUICK_ACTIONS = [
  { id: 'market-trends', label: 'Market trends', prompt: 'What are the latest gold and silver jewelry market trends relevant to our business?' },
  { id: 'customer-demand', label: 'Customer demand', prompt: 'Analyze current customer demand patterns for precious metals and jewelry wholesale.' },
  { id: 'opportunities', label: 'New opportunities', prompt: 'What new market opportunities should LoopC pursue in Central Asia and the Middle East?' },
  { id: 'industry-growth', label: 'Industry growth', prompt: 'What is the industry growth outlook for gold jewelry manufacturing and distribution?' },
  { id: 'sales-strategy', label: 'Sales strategy', prompt: 'Suggest a sales strategy for the next quarter based on market conditions and our pipeline.' },
  { id: 'pipeline', label: 'Analyze our pipeline', prompt: 'Analyze our CRM pipeline and recommend priorities for closing deals.' },
]

const LOADING_STEPS = [
  'Searching market sources…',
  'Reading CRM pipeline…',
  'Checking customer exposure…',
  'Building your briefing…',
]

export function shouldShowSalesManagerAi({ branding, token }) {
  return Boolean(
    token
    && branding?.featureFlags?.salesManagerAi,
  )
}

function isManager(user) {
  return ['super_admin', 'management'].includes(user?.role)
}

function BriefcaseIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7V6a2 2 0 012-2h4a2 2 0 012 2v1M5 9h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 12h14M9 12v3M15 12v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function SendIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12l12-5-5 12-2-5-5-2z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function collectSources(sections = []) {
  const seen = new Set()
  const out = []
  for (const section of sections) {
    for (const source of section?.sources || []) {
      const url = String(source?.url || '').trim()
      if (!url || seen.has(url)) continue
      seen.add(url)
      out.push({ title: source.title || url, url })
    }
  }
  return out
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function SalesManagerAgentWidget({ user, pageContext = {} }) {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [sessionId, setSessionId] = useState('')
  const [sessions, setSessions] = useState([])
  const [quickActions, setQuickActions] = useState(DEFAULT_QUICK_ACTIONS)
  const [playbooks, setPlaybooks] = useState([])
  const [regions, setRegions] = useState([])
  const [horizons, setHorizons] = useState([])
  const [priorities, setPriorities] = useState([])
  const [chatInputs, setChatInputs] = useState({
    region: '',
    horizon: 'quarter',
    priority: 'growth',
    constraints: '',
    customerId: '',
    dealId: '',
  })
  const [providers, setProviders] = useState({ openai: { configured: false }, tavily: { configured: false } })
  const [synthesisMode, setSynthesisMode] = useState('auto')
  const [draftEmail, setDraftEmail] = useState(null)
  const [tasks, setTasks] = useState([])
  const [taskAgent, setTaskAgent] = useState('marketResearch')
  const [taskPrompt, setTaskPrompt] = useState('')
  const [profile, setProfile] = useState(null)
  const scrollRef = useRef(null)
  const firstName = String(user?.name || 'User').split(' ')[0]
  const manager = isManager(user)

  const mergedPageContext = useMemo(() => ({
    ...pageContext,
    customerId: chatInputs.customerId || pageContext.customerId || '',
    dealId: chatInputs.dealId || pageContext.dealId || '',
    region: chatInputs.region || pageContext.region || '',
  }), [pageContext, chatInputs])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    salesAiApi.getConfig()
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data?.quickActions) && data.quickActions.length) {
          setQuickActions(data.quickActions)
        }
        if (data?.providers) setProviders(data.providers)
        if (data?.synthesisMode) setSynthesisMode(data.synthesisMode)
        if (Array.isArray(data?.playbooks)) setPlaybooks(data.playbooks)
        if (Array.isArray(data?.regions)) setRegions(data.regions)
        if (Array.isArray(data?.horizons)) setHorizons(data.horizons)
        if (Array.isArray(data?.priorities)) setPriorities(data.priorities)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load Sales Manager AI configuration.')
      })

    salesAiApi.listSessions()
      .then((data) => {
        if (!cancelled && Array.isArray(data?.sessions)) setSessions(data.sessions)
      })
      .catch(() => {})

    if (manager) {
      salesAiApi.getProfile()
        .then((data) => { if (!cancelled) setProfile(data?.profile || null) })
        .catch(() => {})
      salesAiApi.listTasks()
        .then((data) => { if (!cancelled && Array.isArray(data?.tasks)) setTasks(data.tasks) })
        .catch(() => {})
    }

    return () => { cancelled = true }
  }, [open, manager])

  useEffect(() => {
    if (pageContext.customerId || pageContext.dealId) {
      setChatInputs((prev) => ({
        ...prev,
        customerId: pageContext.customerId || prev.customerId,
        dealId: pageContext.dealId || prev.dealId,
      }))
    }
  }, [pageContext.customerId, pageContext.dealId])

  useEffect(() => {
    if (!sending) {
      setLoadingStep(0)
      return undefined
    }
    const id = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length)
    }, 2200)
    return () => clearInterval(id)
  }, [sending])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending, open, minimized])

  const sendMessage = useCallback(async (rawText, { playbookId } = {}) => {
    const text = String(rawText || '').trim()
    if ((!text && !playbookId) || sending) return

    setError('')
    setSending(true)
    setDraftEmail(null)
    const displayText = text || playbooks.find((p) => p.id === playbookId)?.label || 'Playbook briefing'
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: displayText }
    const nextHistory = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    try {
      const data = await salesAiApi.chat({
        message: text || displayText,
        history: nextHistory.slice(0, -1),
        pageContext: mergedPageContext,
        chatInputs,
        sessionId: sessionId || undefined,
        playbookId: playbookId || undefined,
      })
      const reply = String(data?.reply || data?.message || 'No response received.').trim()
      const sources = collectSources(data?.sections)
      if (data?.session?.id) setSessionId(data.session.id)
      if (data?.session?.id) {
        setSessions((prev) => {
          const next = prev.filter((s) => s.id !== data.session.id)
          return [{ ...data.session, messageCount: (data.session.messages || []).length }, ...next]
        })
      }
      if (data?.meta?.draftEmail) setDraftEmail(data.meta.draftEmail)
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        sources,
        meta: data?.meta?.model ? `Model: ${data.meta.model}` : (data?.meta?.synthesisMode === 'template' ? 'Template report' : ''),
      }])
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Sales Manager AI request failed.'
      setError(msg)
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `_${msg}_`,
      }])
    } finally {
      setSending(false)
    }
  }, [chatInputs, mergedPageContext, messages, playbooks, sending, sessionId])

  const handleExport = useCallback(async () => {
    if (!sessionId) {
      setError('Send a message first to create a saved session.')
      return
    }
    try {
      const blob = await salesAiApi.exportSession(sessionId)
      downloadBlob(blob, 'sales-briefing.md')
    } catch {
      setError('Could not export briefing.')
    }
  }, [sessionId])

  const handleNewSession = useCallback(() => {
    setSessionId('')
    setMessages([])
    setDraftEmail(null)
  }, [])

  const handleLoadSession = useCallback(async (id) => {
    try {
      const data = await salesAiApi.getSession(id)
      const session = data?.session
      if (!session) return
      setSessionId(session.id)
      setMessages((session.messages || []).map((m, i) => ({
        id: `${m.role}-${i}`,
        role: m.role,
        content: m.content,
      })))
    } catch {
      setError('Could not load session.')
    }
  }, [])

  const handleCreateTask = useCallback(async () => {
    const prompt = taskPrompt.trim()
    if (!prompt) return
    try {
      const data = await salesAiApi.createTask({ agent: taskAgent, prompt, pageContext: mergedPageContext })
      if (data?.task) setTasks((prev) => [data.task, ...prev])
      setTaskPrompt('')
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not create agent task.')
    }
  }, [mergedPageContext, taskAgent, taskPrompt])

  const handleRunTask = useCallback(async (taskId) => {
    try {
      const data = await salesAiApi.runTask(taskId)
      if (data?.task) {
        setTasks((prev) => prev.map((t) => (String(t._id) === String(data.task._id) ? data.task : t)))
      }
      if (data?.reply) {
        setMessages((prev) => [...prev,
          { id: `u-task-${Date.now()}`, role: 'user', content: `[${data.task?.agent}] ${data.task?.prompt}` },
          { id: `a-task-${Date.now()}`, role: 'assistant', content: data.reply },
        ])
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Task run failed.')
    }
  }, [])

  const handleSaveProfile = useCallback(async () => {
    if (!profile) return
    try {
      const data = await salesAiApi.updateProfile(profile)
      setProfile(data?.profile || profile)
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save business profile.')
    }
  }, [profile])

  const panelStyle = {
    position: 'fixed',
    right: 20,
    bottom: 20,
    width: 'min(420px, calc(100vw - 24px))',
    zIndex: 10050,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'min(680px, calc(100vh - 40px))',
    background: '#fff',
    border: '1px solid #e5e7eb',
  }

  const selectStyle = {
    fontSize: 11,
    padding: '5px 8px',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    background: '#fff',
    flex: 1,
    minWidth: 0,
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open Sales Manager AI"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 10050,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          color: '#fff',
          background: 'linear-gradient(135deg, #00684A 0%, #13AA52 55%, #00b4d8 100%)',
          boxShadow: '0 10px 28px rgba(0, 104, 74, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BriefcaseIcon size={24} />
      </button>
    )
  }

  return (
    <div style={panelStyle} role="dialog" aria-label="Sales Manager AI">
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
        padding: '12px 14px',
        background: 'linear-gradient(135deg, #00684A 0%, #13AA52 100%)',
        color: '#fff',
      }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Sales Manager AI</div>
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>Research + CRM + ERP exposure</div>
          {!minimized && (
            <div style={{ fontSize: 10, opacity: 0.82, marginTop: 4 }}>
              Hi {firstName} — markets, pipeline, and customer risk in one briefing.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" aria-label="Tools" onClick={() => setShowTools((v) => !v)} style={iconBtnStyle}>⚙</button>
          <button type="button" aria-label="Minimize" onClick={() => setMinimized((v) => !v)} style={iconBtnStyle}>−</button>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} style={iconBtnStyle}>×</button>
        </div>
      </div>

      {!minimized && (
        <>
          {showTools && (
            <div style={{ padding: '10px 12px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 11 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                <select value={chatInputs.region} onChange={(e) => setChatInputs((p) => ({ ...p, region: e.target.value }))} style={selectStyle} aria-label="Region">
                  {(regions.length ? regions : [{ id: '', label: 'Global' }]).map((r) => (
                    <option key={r.id || 'global'} value={r.id}>{r.label}</option>
                  ))}
                </select>
                <select value={chatInputs.horizon} onChange={(e) => setChatInputs((p) => ({ ...p, horizon: e.target.value }))} style={selectStyle} aria-label="Horizon">
                  {(horizons.length ? horizons : [{ id: 'quarter', label: 'This quarter' }]).map((h) => (
                    <option key={h.id} value={h.id}>{h.label}</option>
                  ))}
                </select>
                <select value={chatInputs.priority} onChange={(e) => setChatInputs((p) => ({ ...p, priority: e.target.value }))} style={selectStyle} aria-label="Priority">
                  {(priorities.length ? priorities : [{ id: 'growth', label: 'Growth' }]).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <input
                value={chatInputs.constraints}
                onChange={(e) => setChatInputs((p) => ({ ...p, constraints: e.target.value }))}
                placeholder="Constraints (e.g. no UAE buyers until Q3)"
                style={{ ...selectStyle, width: '100%', marginBottom: 6 }}
              />
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  value={chatInputs.customerId}
                  onChange={(e) => setChatInputs((p) => ({ ...p, customerId: e.target.value }))}
                  placeholder="Customer scope ID"
                  style={selectStyle}
                />
                <input
                  value={chatInputs.dealId}
                  onChange={(e) => setChatInputs((p) => ({ ...p, dealId: e.target.value }))}
                  placeholder="Deal scope ID"
                  style={selectStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                <button type="button" onClick={handleNewSession} style={toolBtnStyle}>New chat</button>
                <button type="button" onClick={handleExport} disabled={!sessionId} style={toolBtnStyle}>Export .md</button>
                {sessions.slice(0, 5).map((s) => (
                  <button key={s.id} type="button" onClick={() => void handleLoadSession(s.id)} style={toolBtnStyle}>
                    {s.title?.slice(0, 18) || 'Session'}
                  </button>
                ))}
              </div>
              {playbooks.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {playbooks.map((pb) => (
                    <button
                      key={pb.id}
                      type="button"
                      disabled={sending}
                      onClick={() => void sendMessage('', { playbookId: pb.id })}
                      style={{ ...toolBtnStyle, background: '#ecfdf5', color: '#065f46' }}
                    >
                      {pb.label}
                    </button>
                  ))}
                </div>
              )}
              {manager && profile && (
                <details style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Business profile</summary>
                  <textarea
                    value={(profile.targetRegions || []).join(', ')}
                    onChange={(e) => setProfile((p) => ({ ...p, targetRegions: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))}
                    placeholder="Target regions (comma-separated)"
                    rows={2}
                    style={{ ...selectStyle, width: '100%', marginTop: 6 }}
                  />
                  <textarea
                    value={profile.productFocus || ''}
                    onChange={(e) => setProfile((p) => ({ ...p, productFocus: e.target.value }))}
                    placeholder="Product focus"
                    rows={2}
                    style={{ ...selectStyle, width: '100%', marginTop: 6 }}
                  />
                  <textarea
                    value={profile.quarterlyGoals || ''}
                    onChange={(e) => setProfile((p) => ({ ...p, quarterlyGoals: e.target.value }))}
                    placeholder="Quarterly goals"
                    rows={2}
                    style={{ ...selectStyle, width: '100%', marginTop: 6 }}
                  />
                  <button type="button" onClick={() => void handleSaveProfile()} style={{ ...toolBtnStyle, marginTop: 6 }}>Save profile</button>
                </details>
              )}
              {manager && (
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Agent tasks</summary>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <select value={taskAgent} onChange={(e) => setTaskAgent(e.target.value)} style={selectStyle}>
                      <option value="marketResearch">Market research</option>
                      <option value="crmInsight">CRM insight</option>
                      <option value="competitiveIntel">Competitive intel</option>
                      <option value="customerRisk">Customer risk</option>
                      <option value="strategy">Strategy</option>
                    </select>
                  </div>
                  <input
                    value={taskPrompt}
                    onChange={(e) => setTaskPrompt(e.target.value)}
                    placeholder="Assign research prompt…"
                    style={{ ...selectStyle, width: '100%', marginTop: 6 }}
                  />
                  <button type="button" onClick={() => void handleCreateTask()} style={{ ...toolBtnStyle, marginTop: 6 }}>Queue task</button>
                  {tasks.slice(0, 5).map((t) => (
                    <div key={String(t._id)} style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.agent}: {t.prompt?.slice(0, 40)}
                      </span>
                      <span style={{ color: '#6b7280' }}>{t.status}</span>
                      {t.status === 'queued' && (
                        <button type="button" onClick={() => void handleRunTask(t._id)} style={toolBtnStyle}>Run</button>
                      )}
                    </div>
                  ))}
                </details>
              )}
            </div>
          )}

          <div ref={scrollRef} style={{ flex: 1, maxHeight: 400, overflowY: 'auto', padding: '14px 14px 8px', background: '#fafafa' }}>
            {messages.length === 0 && !sending && (
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, padding: '4px 2px 10px' }}>
                I combine Tavily web research with CRM, ERP customer exposure, and live metal rates.
                {mergedPageContext.tab && (
                  <div style={{ marginTop: 6 }}>Context: {mergedPageContext.tab}{mergedPageContext.erpSubTab ? ` / ${mergedPageContext.erpSubTab}` : ''}</div>
                )}
                {synthesisMode === 'template' && (
                  <div style={{ marginTop: 8, color: '#065f46' }}>Report mode — no OpenAI credits required.</div>
                )}
                {!providers.tavily?.configured && (
                  <div style={{ marginTop: 8, color: '#b45309' }}>Web research is limited until TAVILY_API_KEY is configured.</div>
                )}
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  marginBottom: 10,
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '92%',
                  padding: '10px 12px',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? '#00684A' : '#fff',
                  color: m.role === 'user' ? '#fff' : '#1f2937',
                  border: m.role === 'user' ? 'none' : '1px solid #e5e7eb',
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
                >
                  <SalesMessageContent content={m.content} variant={m.role === 'user' ? 'user' : 'assistant'} />
                  {m.sources?.length ? (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Sources</div>
                      {m.sources.map((s) => (
                        <div key={s.url} style={{ marginBottom: 2 }}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: '#00684A' }}>
                            {s.title}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {m.meta ? (
                    <div style={{ marginTop: 6, fontSize: 10, opacity: 0.72 }}>{m.meta}</div>
                  ) : null}
                </div>
              </div>
            ))}
            {draftEmail && (
              <div style={{ marginBottom: 10, padding: 10, background: '#fff', border: '1px solid #d1fae5', borderRadius: 10, fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Draft email</div>
                <div style={{ color: '#374151', marginBottom: 6 }}>Subject: {draftEmail.subject}</div>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 11 }}>{draftEmail.body}</pre>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(`Subject: ${draftEmail.subject}\n\n${draftEmail.body}`)}
                  style={{ ...toolBtnStyle, marginTop: 8 }}
                >
                  Copy to clipboard
                </button>
              </div>
            )}
            {sending && (
              <div style={{ fontSize: 12, color: '#6b7280', padding: '4px 2px' }}>
                {LOADING_STEPS[loadingStep]}
              </div>
            )}
          </div>

          <div style={{ padding: '8px 12px 4px', display: 'flex', flexWrap: 'wrap', gap: 6, background: '#fff', borderTop: '1px solid #f1f5f9' }}>
            {quickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={sending}
                onClick={() => void sendMessage(action.prompt)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid #d1fae5',
                  background: '#f0fdf4',
                  color: '#065f46',
                  cursor: sending ? 'not-allowed' : 'pointer',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ padding: '0 12px 6px', fontSize: 11, color: '#b45309', background: '#fffbeb' }}>
              {error}
            </div>
          )}

          <form
            style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px 8px', background: '#fff', borderTop: '1px solid #f1f5f9' }}
            onSubmit={(e) => {
              e.preventDefault()
              void sendMessage(input)
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about market trends, demand, or your pipeline…"
              disabled={sending}
              style={{
                flex: 1,
                border: '1px solid #e5e7eb',
                borderRadius: 999,
                padding: '10px 14px',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: 'none',
                background: 'linear-gradient(135deg, #00684A 0%, #13AA52 100%)',
                color: '#fff',
                cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: sending || !input.trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <SendIcon size={16} />
            </button>
          </form>

          <p style={{ margin: 0, padding: '0 12px 10px', fontSize: 10, color: '#9ca3af', textAlign: 'center', background: '#fff' }}>
            Tavily research · CRM · ERP exposure · saved sessions
          </p>
        </>
      )}
    </div>
  )
}

const iconBtnStyle = {
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.18)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
}

const toolBtnStyle = {
  fontSize: 10,
  fontWeight: 600,
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  cursor: 'pointer',
}
