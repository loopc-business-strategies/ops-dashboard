import React, { useCallback, useEffect, useRef, useState } from 'react'
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
  'Searching web sources…',
  'Reading your pipeline…',
  'Building your answer…',
]

export function shouldShowSalesManagerAi({ branding, token }) {
  return Boolean(
    token
    && branding?.key === 'loopc'
    && branding?.featureFlags?.salesManagerAi,
  )
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

function formatRelativeTime(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60000) return 'just now'
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return `${Math.floor(ms / 86400000)}d ago`
}

function formatUntil(iso) {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'soon'
  if (ms < 3600000) return `${Math.ceil(ms / 60000)}m`
  return `${Math.ceil(ms / 3600000)}h`
}

function stripMarkdown(text) {
  return String(text || '').replace(/\*\*/g, '')
}

function BriefingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[72, 88, 64].map((w) => (
        <div
          key={w}
          style={{
            height: 12,
            width: `${w}%`,
            borderRadius: 6,
            background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
            backgroundSize: '200% 100%',
            animation: 'salesAiPulse 1.2s ease-in-out infinite',
          }}
        />
      ))}
      <style>{'@keyframes salesAiPulse { 0% { background-position: 100% 0 } 100% { background-position: -100% 0 } }'}</style>
    </div>
  )
}

function TodaysPulsePanel({
  briefing,
  loading,
  onRefresh,
  refreshing,
  synthesisMode,
  providers,
  onSuggestionClick,
}) {
  if (loading && !briefing) {
    return (
      <div style={pulseCardStyle}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#065f46', marginBottom: 8 }}>Today&apos;s pulse</div>
        <BriefingSkeleton />
      </div>
    )
  }

  if (!briefing) {
    return (
      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, padding: '4px 2px 10px' }}>
        I combine Tavily web research with your LoopC CRM and live metal rates.
      </div>
    )
  }

  const s = briefing.crm?.summary || {}
  const market = briefing.market
  const highlight = briefing.crm?.highlight

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#065f46' }}>
          Today&apos;s pulse
          <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
            {formatRelativeTime(briefing.generatedAt)}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh briefing"
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #d1fae5',
            background: '#fff',
            color: '#065f46',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={pulseCardStyle}>
        <div style={pulseSectionTitle}>Your pipeline</div>
        <div style={pulseBody}>
          {s.pipelineValueUSD ? `$${Number(s.pipelineValueUSD).toLocaleString()} pipeline` : 'No pipeline value yet'}
          {s.hotLeads ? ` · ${s.hotLeads} hot lead(s)` : ''}
          {s.overdueFollowups ? ` · ${s.overdueFollowups} overdue follow-up(s)` : ''}
        </div>
        {highlight?.topDeal ? (
          <div style={{ ...pulseBody, marginTop: 4, color: '#374151' }}>
            Top deal: {highlight.topDeal.title} ({highlight.topDeal.stage})
          </div>
        ) : null}
      </div>

      {market?.bullets?.length ? (
        <div style={pulseCardStyle}>
          <div style={pulseSectionTitle}>Market trend</div>
          {market.bullets.map((bullet) => (
            <div key={bullet.slice(0, 40)} style={{ ...pulseBody, marginBottom: 4 }}>{bullet}</div>
          ))}
          {market.source?.url ? (
            <a
              href={market.source.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#00684A' }}
            >
              {market.source.title}
            </a>
          ) : null}
          {market.cachedUntil ? (
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
              Research cached · refreshes in {formatUntil(market.cachedUntil)}
            </div>
          ) : null}
        </div>
      ) : null}

      {briefing.suggestions?.length ? (
        <div style={pulseCardStyle}>
          <div style={pulseSectionTitle}>Suggested</div>
          {briefing.suggestions.map((tip) => (
            <button
              key={tip}
              type="button"
              onClick={() => onSuggestionClick(stripMarkdown(tip))}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                marginBottom: 4,
                padding: 0,
                border: 'none',
                background: 'none',
                fontSize: 12,
                lineHeight: 1.45,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              · {stripMarkdown(tip)}
            </button>
          ))}
        </div>
      ) : null}

      {synthesisMode === 'template' && (
        <div style={{ fontSize: 11, color: '#065f46' }}>Report mode — no OpenAI credits required.</div>
      )}
      {!providers.tavily?.configured && (
        <div style={{ fontSize: 11, color: '#b45309' }}>Web research is limited until TAVILY_API_KEY is configured.</div>
      )}
    </div>
  )
}

export default function SalesManagerAgentWidget({ user, activeTab }) {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [quickActions, setQuickActions] = useState(DEFAULT_QUICK_ACTIONS)
  const [providers, setProviders] = useState({ openai: { configured: false }, tavily: { configured: false } })
  const [synthesisMode, setSynthesisMode] = useState('auto')
  const [loadingStep, setLoadingStep] = useState(0)
  const [briefing, setBriefing] = useState(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingRefreshing, setBriefingRefreshing] = useState(false)
  const scrollRef = useRef(null)
  const firstName = String(user?.name || 'User').split(' ')[0]

  const loadBriefing = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setBriefingRefreshing(true)
    else setBriefingLoading(true)
    try {
      const data = await salesAiApi.getBriefing()
      setBriefing(data)
    } catch {
      if (!refresh) setBriefing(null)
    } finally {
      if (refresh) setBriefingRefreshing(false)
      else setBriefingLoading(false)
    }
  }, [])

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
      })
      .catch(() => {
        if (!cancelled) setError('Could not load Sales Manager AI configuration.')
      })
    void loadBriefing()
    return () => { cancelled = true }
  }, [open, loadBriefing])

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

  const sendMessage = useCallback(async (rawText) => {
    const text = String(rawText || '').trim()
    if (!text || sending) return

    setError('')
    setSending(true)
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: text }
    const nextHistory = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    try {
      const data = await salesAiApi.chat({
        message: text,
        history: nextHistory.slice(0, -1),
        pageContext: { tab: activeTab || '' },
      })
      const reply = String(data?.reply || data?.message || 'No response received.').trim()
      const sources = collectSources(data?.sections)
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
  }, [activeTab, messages, sending])

  const panelStyle = {
    position: 'fixed',
    right: 20,
    bottom: 20,
    width: 'min(400px, calc(100vw - 24px))',
    zIndex: 10050,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'min(640px, calc(100vh - 40px))',
    background: '#fff',
    border: '1px solid #e5e7eb',
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
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>LoopC · research + your data</div>
          {!minimized && (
            <div style={{ fontSize: 10, opacity: 0.82, marginTop: 4 }}>
              Hi {firstName} — ask about markets, demand, or your pipeline.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" aria-label="Minimize" onClick={() => setMinimized((v) => !v)} style={iconBtnStyle}>−</button>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} style={iconBtnStyle}>×</button>
        </div>
      </div>

      {!minimized && (
        <>
          <div ref={scrollRef} style={{ flex: 1, maxHeight: 420, overflowY: 'auto', padding: '14px 14px 8px', background: '#fafafa' }}>
            {messages.length === 0 && !sending && (
              <TodaysPulsePanel
                briefing={briefing}
                loading={briefingLoading}
                refreshing={briefingRefreshing}
                onRefresh={() => void loadBriefing({ refresh: true })}
                synthesisMode={synthesisMode}
                providers={providers}
                onSuggestionClick={(text) => void sendMessage(text)}
              />
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
            External research via Tavily · grounded in LoopC CRM & metal rates
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

const pulseCardStyle = {
  padding: '10px 12px',
  borderRadius: 10,
  background: '#fff',
  border: '1px solid #e5e7eb',
}

const pulseSectionTitle = {
  fontSize: 11,
  fontWeight: 700,
  color: '#00684A',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
}

const pulseBody = {
  fontSize: 12,
  color: '#4b5563',
  lineHeight: 1.45,
}
