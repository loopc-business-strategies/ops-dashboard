import React, { useCallback, useEffect, useRef, useState } from 'react'
import aiApi from '../api/ai'
import { getLastApiError, subscribeLastApiError } from '../utils/lastApiError'

const QUICK_ACTIONS = [
  { id: 'summary', label: "Show today's summary", prompt: "Show today's summary for my dashboard" },
  { id: 'inventory', label: 'Check inventory status', prompt: 'How do I check inventory status and stock levels?' },
  { id: 'sales', label: 'Sales performance', prompt: 'Where can I see sales performance and pipeline?' },
  { id: 'alerts', label: 'View alerts', prompt: 'Show my open tasks and alerts' },
  { id: 'market', label: 'Live metal prices', prompt: 'What are the current gold, silver, and platinum prices?' },
  { id: 'fix', label: 'Fix last error', prompt: 'Diagnose and fix my last application error' },
]

const BUILTIN_PROVIDER = 'builtin'
const OPENAI_PROVIDER = 'openai'

function AgentIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2L14.2 8.2L20.5 8.5L15.8 12.5L17.2 18.8L12 15.5L6.8 18.8L8.2 12.5L3.5 8.5L9.8 8.2L12 2Z" fill="currentColor" opacity="0.95" />
      <circle cx="12" cy="12" r="3" fill="#fff" opacity="0.9" />
    </svg>
  )
}

export default function AIAgentWidget({ user, activeTab, tenantLabel }) {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [lastError, setLastErrorState] = useState(() => getLastApiError())
  const [messages, setMessages] = useState([])
  const [aiConfig, setAiConfig] = useState(null)
  const [selectedProvider, setSelectedProvider] = useState(BUILTIN_PROVIDER)
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const scrollRef = useRef(null)
  const firstName = String(user?.name || 'User').split(' ')[0]

  const openAiAvailable = Boolean(aiConfig?.openai?.configured)
  const providerLabel = selectedProvider === OPENAI_PROVIDER && openAiAvailable
    ? 'ChatGPT'
    : 'LoopC'

  useEffect(() => subscribeLastApiError(setLastErrorState), [])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    void aiApi.getConfig()
      .then((cfg) => {
        if (cancelled) return
        setAiConfig(cfg)
        setSelectedProvider(BUILTIN_PROVIDER)
        if (cfg?.openai?.defaultModel) setSelectedModel(cfg.openai.defaultModel)
      })
      .catch(() => {
        if (!cancelled) {
          setAiConfig({
            providerLabel: 'LoopC',
            providers: [{ id: BUILTIN_PROVIDER, label: 'LoopC', available: true }],
            openai: { configured: false, models: [] },
          })
        }
      })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open || messages.length > 0) return
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Hello ${firstName}! 👋 I'm **LoopC**, built into this dashboard.\n\nAsk about **market prices**, **ERP help**, or describe a problem and I'll give a **fix plan**. ChatGPT can be enabled later by your admin.`,
    }])
  }, [open, firstName, messages.length])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sending, open])

  const sendMessage = useCallback(async (text) => {
    const trimmed = String(text || '').trim()
    if (!trimmed || sending) return

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    const useOpenAi = selectedProvider === OPENAI_PROVIDER && openAiAvailable

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await aiApi.chat({
        message: trimmed,
        history,
        provider: useOpenAi ? OPENAI_PROVIDER : BUILTIN_PROVIDER,
        model: useOpenAi ? selectedModel : undefined,
        pageContext: {
          tab: activeTab || '',
          path: typeof window !== 'undefined' ? window.location.pathname : '',
          tenant: tenantLabel || '',
        },
        lastError: getLastApiError(),
      })

      const meta = res?.provider === OPENAI_PROVIDER
        ? `ChatGPT · ${res?.model || selectedModel}`
        : 'LoopC · built-in'

      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res?.reply || 'Sorry, I could not generate a response.',
        meta,
      }])
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not reach the AI agent. Check your connection and try again.'
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ${msg}`,
      }])
    } finally {
      setSending(false)
    }
  }, [activeTab, messages, openAiAvailable, selectedModel, selectedProvider, sending, tenantLabel])

  const panelStyle = {
    position: 'fixed',
    right: 20,
    bottom: 20,
    width: 'min(380px, calc(100vw - 24px))',
    zIndex: 10050,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.28)',
    border: '1px solid rgba(255,255,255,0.12)',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'inherit',
  }

  const headerStyle = {
    background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
    color: '#fff',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open LoopC"
        onClick={() => { setOpen(true); setMinimized(false) }}
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
          background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
          boxShadow: '0 12px 28px rgba(124, 58, 237, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AgentIcon size={22} />
      </button>
    )
  }

  return (
    <div style={panelStyle} role="dialog" aria-label="LoopC">
      <div style={headerStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <AgentIcon size={16} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>LoopC</div>
              <div style={{ fontSize: 10, opacity: 0.92, marginTop: 2 }}>{providerLabel}</div>
            </div>
          </div>
          {!minimized && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ opacity: 0.9, whiteSpace: 'nowrap' }}>Engine</span>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                disabled={sending}
                style={selectStyle}
              >
                <option value={BUILTIN_PROVIDER}>LoopC (built-in)</option>
                <option value={OPENAI_PROVIDER} disabled={!openAiAvailable}>
                  ChatGPT{openAiAvailable ? '' : ' — add API key later'}
                </option>
              </select>
            </label>
          )}
          {!minimized && selectedProvider === OPENAI_PROVIDER && openAiAvailable && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ opacity: 0.9, whiteSpace: 'nowrap' }}>Model</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={sending}
                style={selectStyle}
              >
                {(aiConfig?.openai?.models || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-start' }}>
          <button type="button" aria-label="Minimize" onClick={() => setMinimized((v) => !v)} style={iconBtnStyle}>−</button>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} style={iconBtnStyle}>×</button>
        </div>
      </div>

      {!minimized && (
        <>
          <div ref={scrollRef} style={{ flex: 1, maxHeight: 360, overflowY: 'auto', padding: '14px 14px 8px', background: '#fafafa' }}>
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
                  background: m.role === 'user' ? '#7c3aed' : '#fff',
                  color: m.role === 'user' ? '#fff' : '#1f2937',
                  border: m.role === 'user' ? 'none' : '1px solid #e5e7eb',
                  fontSize: 13,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                }}
                >
                  {m.content.split(/\*\*(.*?)\*\*/g).map((part, i) => (
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                  ))}
                  {m.meta ? (
                    <div style={{ marginTop: 6, fontSize: 10, opacity: 0.72 }}>{m.meta}</div>
                  ) : null}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ fontSize: 12, color: '#6b7280', padding: '4px 2px' }}>Thinking…</div>
            )}
          </div>

          <div style={{ padding: '8px 12px 4px', display: 'flex', flexWrap: 'wrap', gap: 6, background: '#fff', borderTop: '1px solid #f1f5f9' }}>
            {QUICK_ACTIONS.map((action) => (
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
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  color: '#374151',
                  cursor: sending ? 'not-allowed' : 'pointer',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>

          {lastError && (
            <div style={{ padding: '0 12px 6px', fontSize: 11, color: '#b45309', background: '#fffbeb' }}>
              Last error captured: HTTP {lastError.status} — {lastError.message}
            </div>
          )}

          <form
            style={{ display: 'flex', gap: 8, padding: '10px 12px 8px', background: '#fff', borderTop: '1px solid #f1f5f9' }}
            onSubmit={(e) => {
              e.preventDefault()
              void sendMessage(input)
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe a problem or ask a question…"
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
                background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
                color: '#fff',
                cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: sending || !input.trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              ➤
            </button>
          </form>

          <p style={{ margin: 0, padding: '0 12px 10px', fontSize: 10, color: '#9ca3af', textAlign: 'center', background: '#fff' }}>
            Built-in LoopC uses live app data. ChatGPT optional later.
          </p>
        </>
      )}
    </div>
  )
}

const selectStyle = {
  flex: 1,
  minWidth: 0,
  border: 'none',
  borderRadius: 8,
  padding: '4px 8px',
  fontSize: 11,
  fontWeight: 600,
  color: '#1f2937',
  background: 'rgba(255,255,255,0.92)',
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
