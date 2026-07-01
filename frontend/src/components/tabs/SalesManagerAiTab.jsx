import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import * as salesAiApi from '../../api/salesAi'
import * as emailConnectApi from '../../api/emailConnect'
import SalesMessageContent from '../salesAi/SalesMessageContent'
import {
  SALES_AI_THEME,
  chipStyle,
  pulseBodyStyle,
  pulseCardStyle,
  pulseSectionTitleStyle,
} from '../salesAi/salesAiTheme'

const INPUT_CLASS = 'sales-ai-chat-input'

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

const LOADING_STEPS_EMAIL = [
  'Checking your inbox…',
  'Analyzing messages…',
  'Building your answer…',
]

function isEmailIntent(text) {
  const msg = String(text || '').toLowerCase()
  return /\b(emails?|e-mail|inbox|gmail|unread|mailbox)\b/.test(msg)
    || /\b(outlook\s+(mail|inbox|email)|microsoft\s+outlook)\b/.test(msg)
    || /check\s+(my\s+)?emails?/.test(msg)
    || /\b(analyze|summar|scan|review|read)\s+(my\s+)?(all\s+)?(the\s+)?(emails?|inbox|mail)/.test(msg)
    || /all\s+(my\s+)?emails?/.test(msg)
    || /everything\s+in\s+(my\s+)?(inbox|mailbox|email)/.test(msg)
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

function BriefingSkeleton({ theme = SALES_AI_THEME }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[72, 88, 64].map((w) => (
        <div
          key={w}
          style={{
            height: 12,
            width: `${w}%`,
            borderRadius: 6,
            background: theme.skeleton,
            backgroundSize: '200% 100%',
            animation: 'salesAiPulse 1.2s ease-in-out infinite',
          }}
        />
      ))}
      <style>{'@keyframes salesAiPulse { 0% { background-position: 100% 0 } 100% { background-position: -100% 0 } }'}</style>
    </div>
  )
}

function ProposalCards({ proposals, onApprove, onDismiss, theme = SALES_AI_THEME }) {
  if (!proposals?.length) return null
  const card = pulseCardStyle(theme)
  const sectionTitle = pulseSectionTitleStyle(theme)
  const btnPrimary = {
    fontSize: 11,
    fontWeight: 600,
    padding: '6px 12px',
    borderRadius: 8,
    border: `1px solid ${theme.accentBorder}`,
    background: theme.accentSoft,
    color: theme.textPrimary,
    cursor: 'pointer',
  }
  return (
    <div style={card}>
      <div style={sectionTitle}>Needs your approval</div>
      {proposals.map((p) => (
        <div key={p.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${theme.cardBorder}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary }}>{p.title}</div>
          {p.summary ? (
            <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>{p.summary}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {p.actionType === 'email_reply_draft' && p.payload?.mailtoUrl ? (
              <a
                href={p.payload.mailtoUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onApprove(p.id)}
                style={{ ...btnPrimary, textDecoration: 'none' }}
              >
                Approve & open draft
              </a>
            ) : (
              <button type="button" onClick={() => onApprove(p.id)} style={btnPrimary}>
                Approve
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(p.id)}
              style={{
                fontSize: 11,
                padding: '6px 12px',
                borderRadius: 8,
                border: `1px solid ${theme.cardBorder}`,
                background: theme.assistantBubble,
                color: theme.textSecondary,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function TodaysPulsePanel({
  briefing,
  loading,
  onRefresh,
  refreshing,
  synthesisMode,
  automationMode,
  automation,
  proposals,
  onApproveProposal,
  onDismissProposal,
  providers,
  email,
  onConnectCompanyGmail,
  onDisconnectCompanyGmail,
  onSuggestionClick,
  theme = SALES_AI_THEME,
}) {
  const card = pulseCardStyle(theme)
  const sectionTitle = pulseSectionTitleStyle(theme)
  const body = pulseBodyStyle(theme)
  const refreshBtn = {
    fontSize: 10,
    padding: '4px 8px',
    borderRadius: 6,
    border: `1px solid ${theme.accentBorder}`,
    background: theme.accentSoft,
    color: theme.textPrimary,
    cursor: refreshing ? 'not-allowed' : 'pointer',
    opacity: refreshing ? 0.6 : 1,
  }

  if (loading && !briefing) {
    return (
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 12, color: theme.textPrimary, marginBottom: 8 }}>Today&apos;s pulse</div>
        <BriefingSkeleton theme={theme} />
      </div>
    )
  }

  if (!briefing) {
    return (
      <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5, padding: '4px 2px 10px' }}>
        I combine Tavily web research with your LoopC CRM and live metal rates.
      </div>
    )
  }

  const s = briefing.crm?.summary || {}
  const market = briefing.market
  const highlight = briefing.crm?.highlight

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: theme.textPrimary }}>
          Today&apos;s pulse
          <span style={{ fontWeight: 400, color: theme.textMuted, marginLeft: 6 }}>
            {formatRelativeTime(briefing.generatedAt)}
          </span>
        </div>
        <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh briefing" style={refreshBtn}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {automation?.todayCount > 0 ? (
        <div style={card}>
          <div style={sectionTitle}>Automation today</div>
          <div style={body}>{automation.todayCount} action{automation.todayCount === 1 ? '' : 's'} ran automatically</div>
          {(automation.recent || []).slice(0, 4).map((item) => (
            <div key={item.id} style={{ ...body, marginTop: 4, fontSize: 11 }}>
              · {item.title}
            </div>
          ))}
        </div>
      ) : null}

      <ProposalCards
        proposals={proposals}
        onApprove={onApproveProposal}
        onDismiss={onDismissProposal}
        theme={theme}
      />

      <div style={card}>
        <div style={sectionTitle}>Your pipeline</div>
        <div style={body}>
          {s.pipelineValueUSD ? `$${Number(s.pipelineValueUSD).toLocaleString()} pipeline` : 'No pipeline value yet'}
          {s.hotLeads ? ` · ${s.hotLeads} hot lead(s)` : ''}
          {s.overdueFollowups ? ` · ${s.overdueFollowups} overdue follow-up(s)` : ''}
        </div>
        {highlight?.topDeal ? (
          <div style={{ ...body, marginTop: 4, color: theme.textPrimary }}>
            Top deal: {highlight.topDeal.title} ({highlight.topDeal.stage})
          </div>
        ) : null}
      </div>

      {market?.bullets?.length ? (
        <div style={card}>
          <div style={sectionTitle}>Market trend</div>
          {market.bullets.map((bullet) => (
            <div key={bullet.slice(0, 40)} style={{ ...body, marginBottom: 4 }}>{bullet}</div>
          ))}
          {market.source?.url ? (
            <a href={market.source.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: theme.link, textDecoration: 'underline' }}>
              {market.source.title}
            </a>
          ) : null}
          {market.cachedUntil ? (
            <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 4 }}>
              Research cached · refreshes in {formatUntil(market.cachedUntil)}
            </div>
          ) : null}
        </div>
      ) : null}

      {briefing.suggestions?.length ? (
        <div style={card}>
          <div style={sectionTitle}>Suggested</div>
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
                color: theme.textPrimary,
                cursor: 'pointer',
              }}
            >
              · {stripMarkdown(tip)}
            </button>
          ))}
        </div>
      ) : null}

      {email?.gmailConfigured && email?.sharedInboxEnabled ? (
        <div style={card}>
          <div style={sectionTitle}>Company inbox</div>
          {email.expectedEmail ? <div style={{ ...body, marginBottom: 6 }}>{email.expectedEmail}</div> : null}
          {email.connected ? (
            <div style={body}>
              Connected · {email.address || email.expectedEmail}
              {email.canManage ? (
                <button
                  type="button"
                  onClick={onDisconnectCompanyGmail}
                  style={{
                    display: 'block',
                    marginTop: 8,
                    fontSize: 11,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1px solid ${theme.dangerBorder}`,
                    background: theme.dangerSoft,
                    color: theme.dangerText,
                    cursor: 'pointer',
                  }}
                >
                  Disconnect company Gmail
                </button>
              ) : null}
            </div>
          ) : (
            <div style={body}>
              {email.canManage
                ? 'Connect the company Gmail account so everyone on this portal can use Check email.'
                : 'Company inbox not connected yet. Ask a super admin to connect Gmail.'}
              {email.canManage ? (
                <button type="button" onClick={onConnectCompanyGmail} style={{ ...refreshBtn, display: 'block', marginTop: 8, fontSize: 11, padding: '6px 12px' }}>
                  Connect company Gmail
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {automationMode || synthesisMode === 'template' ? (
        <div style={{ fontSize: 11, color: theme.textSecondary }}>
          Automation mode — follow-ups run automatically; email replies need approval.
        </div>
      ) : null}
      {!providers.tavily?.configured && (
        <div style={{ fontSize: 11, color: theme.warningText }}>Web research is limited until `TAVILY_API_KEY` is configured.</div>
      )}
    </div>
  )
}

export default function SalesManagerAiTab() {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [quickActions, setQuickActions] = useState(DEFAULT_QUICK_ACTIONS)
  const [providers, setProviders] = useState({ openai: { configured: false }, tavily: { configured: false } })
  const [synthesisMode, setSynthesisMode] = useState('auto')
  const [automationMode, setAutomationMode] = useState(true)
  const [automation, setAutomation] = useState(null)
  const [proposals, setProposals] = useState([])
  const [loadingStep, setLoadingStep] = useState(0)
  const [briefing, setBriefing] = useState(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingRefreshing, setBriefingRefreshing] = useState(false)
  const [email, setEmail] = useState({
    gmailConfigured: false,
    connected: false,
    address: null,
    mode: 'tenant',
    sharedInboxEnabled: false,
    expectedEmail: '',
    canManage: false,
  })
  const [loadingSteps, setLoadingSteps] = useState(LOADING_STEPS)
  const scrollRef = useRef(null)
  const firstName = String(user?.name || 'User').split(' ')[0]
  const theme = SALES_AI_THEME

  const loadAutomation = useCallback(async () => {
    try {
      const data = await salesAiApi.getAutomation()
      if (data?.automation) setAutomation(data.automation)
      if (Array.isArray(data?.proposals)) setProposals(data.proposals)
      if (data?.config?.autoEnabled !== undefined) setAutomationMode(Boolean(data.config.autoEnabled))
    } catch {
      /* optional */
    }
  }, [])

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
    let cancelled = false
    salesAiApi.getConfig()
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data?.quickActions) && data.quickActions.length) setQuickActions(data.quickActions)
        if (data?.providers) setProviders(data.providers)
        if (data?.synthesisMode) setSynthesisMode(data.synthesisMode)
        if (data?.automation?.autoEnabled !== undefined) setAutomationMode(data.automation.autoEnabled)
        if (data?.email) setEmail(data.email)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load Sales Manager AI configuration.')
      })
    void loadBriefing()
    void loadAutomation()
    return () => { cancelled = true }
  }, [loadBriefing, loadAutomation])

  useEffect(() => {
    if (!sending) {
      setLoadingStep(0)
      return undefined
    }
    const id = setInterval(() => {
      setLoadingStep((s) => (s + 1) % loadingSteps.length)
    }, 2200)
    return () => clearInterval(id)
  }, [sending, loadingSteps])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending])

  const handleApproveProposal = useCallback(async (id) => {
    try {
      const data = await salesAiApi.approveProposal(id)
      if (data?.proposal?.payload?.mailtoUrl) {
        window.open(data.proposal.payload.mailtoUrl, '_blank', 'noopener,noreferrer')
      }
      await loadAutomation()
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not approve proposal.')
    }
  }, [loadAutomation])

  const handleDismissProposal = useCallback(async (id) => {
    try {
      await salesAiApi.dismissProposal(id)
      await loadAutomation()
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not dismiss proposal.')
    }
  }, [loadAutomation])

  const sendMessage = useCallback(async (rawText) => {
    const text = String(rawText || '').trim()
    if (!text || sending) return

    setError('')
    setSending(true)
    setLoadingSteps(isEmailIntent(text) ? LOADING_STEPS_EMAIL : LOADING_STEPS)
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: text }
    const nextHistory = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    try {
      const data = await salesAiApi.chat({
        message: text,
        history: nextHistory.slice(0, -1),
        pageContext: { tab: 'sales-manager-ai' },
      })
      const reply = String(data?.reply || data?.message || 'No response received.').trim()
      const sources = collectSources(data?.sections)
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        sources,
        emailConnectRequired: Boolean(data?.meta?.emailConnectRequired),
        emailConnectUrl: data?.meta?.emailConnectUrl || email.connectUrl,
        tenantEmailConnect: Boolean(data?.meta?.tenantEmailConnect),
        emailCanManage: Boolean(data?.meta?.emailCanManage ?? email.canManage),
        meta: data?.meta?.model ? `Model: ${data.meta.model}` : (data?.meta?.synthesisMode === 'template' ? 'Template report' : ''),
      }])
      void loadAutomation()
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Sales Manager AI request failed.'
      setError(msg)
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: `_${msg}_` }])
    } finally {
      setSending(false)
    }
  }, [email.canManage, email.connectUrl, loadAutomation, messages, sending])

  const handleConnectEmail = useCallback(() => {
    if (email.sharedInboxEnabled) emailConnectApi.startTenantGmailConnect()
    else emailConnectApi.startGmailConnect()
  }, [email.sharedInboxEnabled])

  const handleDisconnectCompanyEmail = useCallback(async () => {
    try {
      await emailConnectApi.disconnectTenant()
      const data = await salesAiApi.getConfig()
      if (data?.email) setEmail(data.email)
    } catch {
      setError('Could not disconnect company inbox.')
    }
  }, [])

  const connectBtnStyle = {
    marginTop: 8,
    fontSize: 11,
    fontWeight: 600,
    padding: '6px 12px',
    borderRadius: 8,
    border: `1px solid ${theme.accentBorder}`,
    background: theme.accentSoft,
    color: theme.textPrimary,
    cursor: 'pointer',
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: theme.panelBg,
        color: theme.textPrimary,
      }}
    >
      <header style={{
        flexShrink: 0,
        padding: '14px 20px',
        borderBottom: `1px solid ${theme.cardBorder}`,
        background: theme.headerBg,
      }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, color: theme.textPrimary }}>Sales Manager AI</div>
        <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
          Hi {firstName} — ask about markets, demand, or your pipeline.
        </div>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
        }}
      >
        <aside
          style={{
            flex: '0 0 320px',
            maxWidth: '100%',
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px',
            borderRight: `1px solid ${theme.cardBorder}`,
            background: theme.chatBg,
          }}
        >
          <TodaysPulsePanel
            briefing={briefing}
            loading={briefingLoading}
            refreshing={briefingRefreshing}
            onRefresh={() => void loadBriefing({ refresh: true })}
            synthesisMode={synthesisMode}
            automationMode={automationMode}
            automation={automation}
            proposals={proposals}
            onApproveProposal={(id) => void handleApproveProposal(id)}
            onDismissProposal={(id) => void handleDismissProposal(id)}
            providers={providers}
            email={email}
            onConnectCompanyGmail={handleConnectEmail}
            onDisconnectCompanyGmail={() => void handleDisconnectCompanyEmail()}
            onSuggestionClick={(text) => void sendMessage(text)}
            theme={theme}
          />
        </aside>

        <div
          ref={scrollRef}
          style={{
            flex: '1 1 360px',
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px 20px',
            background: theme.chatBg,
          }}
        >
          {messages.length === 0 && !sending && (
            <div style={{ fontSize: 13, color: theme.textMuted, padding: '20px 0' }}>
              Start a conversation or pick a quick action below.
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                marginBottom: 12,
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: m.role === 'user' ? theme.userBubble : theme.assistantBubble,
                color: m.role === 'user' ? theme.userText : theme.textPrimary,
                border: `1px solid ${theme.cardBorder}`,
                fontSize: 13,
                lineHeight: 1.45,
              }}
              >
                <SalesMessageContent content={m.content} variant={m.role === 'user' ? 'user' : 'assistant'} theme={theme} />
                {m.sources?.length ? (
                  <div style={{ marginTop: 8, fontSize: 11, color: theme.textSecondary }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: theme.textPrimary }}>Sources</div>
                    {m.sources.map((s) => (
                      <div key={s.url} style={{ marginBottom: 2 }}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: theme.link, textDecoration: 'underline' }}>
                          {s.title}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : null}
                {m.emailConnectRequired && m.emailCanManage ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (m.tenantEmailConnect) emailConnectApi.startTenantGmailConnect()
                      else emailConnectApi.startGmailConnect()
                    }}
                    style={connectBtnStyle}
                  >
                    {m.tenantEmailConnect ? 'Connect company Gmail' : 'Connect Gmail'}
                  </button>
                ) : null}
                {m.meta ? (
                  <div style={{ marginTop: 6, fontSize: 10, color: theme.textMuted }}>{m.meta}</div>
                ) : null}
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ fontSize: 12, color: theme.textSecondary, padding: '4px 2px' }}>
              {loadingSteps[loadingStep]}
            </div>
          )}
        </div>
      </div>

      <footer style={{
        flexShrink: 0,
        borderTop: `1px solid ${theme.cardBorder}`,
        background: theme.footerBg,
      }}
      >
        <div style={{ padding: '10px 16px 6px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={sending}
              onClick={() => void sendMessage(action.prompt)}
              style={chipStyle(theme, { disabled: sending })}
            >
              {action.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: '0 16px 6px', fontSize: 11, color: theme.errorText }}>
            {error}
          </div>
        )}

        <form
          style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px 12px' }}
          onSubmit={(e) => {
            e.preventDefault()
            void sendMessage(input)
          }}
        >
          <input
            className={INPUT_CLASS}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about market trends, demand, or your pipeline…"
            disabled={sending}
            style={{
              flex: 1,
              border: `1px solid ${theme.inputBorder}`,
              borderRadius: 999,
              padding: '10px 14px',
              fontSize: 13,
              outline: 'none',
              background: theme.inputBg,
              color: theme.inputText,
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
              background: theme.sendButtonBg,
              color: theme.sendButtonText,
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

        <p style={{ margin: 0, padding: '0 16px 10px', fontSize: 10, color: theme.textMuted, textAlign: 'center' }}>
          External research via Tavily · grounded in LoopC CRM & metal rates
        </p>
        <style>{`.${INPUT_CLASS}::placeholder { color: ${theme.placeholder}; opacity: 1; }`}</style>
      </footer>
    </div>
  )
}
