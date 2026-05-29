import React, { useCallback, useEffect, useRef, useState } from 'react'
import aiApi from '../api/ai'
import { getLastApiError, subscribeLastApiError } from '../utils/lastApiError'

const QUICK_ACTIONS = [
  { id: 'analyze', label: 'Analyze my company', prompt: 'Analyze my company and give me a full report' },
  { id: 'project', label: 'Map project code', prompt: 'Show my whole project code structure and architecture' },
  { id: 'summary', label: "Today's summary", prompt: "Show today's summary for my dashboard" },
  { id: 'market', label: 'Live metal prices', prompt: 'What are the current gold, silver, and platinum prices?' },
  { id: 'inventory', label: 'Inventory status', prompt: 'Check inventory status and low stock alerts' },
  { id: 'sales', label: 'CRM pipeline', prompt: 'Show CRM pipeline and sales performance' },
  { id: 'alerts', label: 'View alerts', prompt: 'Show my open tasks and alerts' },
  { id: 'fix', label: 'Fix last error', prompt: 'Diagnose and fix my last application error' },
  { id: 'help', label: 'What can you do?', prompt: 'What can you do? List your capabilities' },
]

const BUILTIN_PROVIDER = 'builtin'
const OPENAI_PROVIDER = 'openai'
const PROVIDER_STORAGE_KEY = 'loopc-ai-provider'

function readStoredProvider() {
  try {
    return localStorage.getItem(PROVIDER_STORAGE_KEY) || BUILTIN_PROVIDER
  } catch {
    return BUILTIN_PROVIDER
  }
}

function storeProvider(provider) {
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider)
  } catch {
    /* ignore */
  }
}

const ACCEPT_UPLOAD = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.json,.md,.xlsx,.xls,.ppt,.pptx,.xml,.html,.log'
const MAX_FILES = 5

function formatFileSize(bytes = 0) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fileKindLabel(file) {
  const type = String(file?.type || '')
  if (type.startsWith('image/')) return 'Image'
  if (type.startsWith('audio/')) return 'Audio'
  if (type.startsWith('video/')) return 'Video'
  if (type.includes('pdf')) return 'PDF'
  return 'Document'
}

function AgentIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2L14.2 8.2L20.5 8.5L15.8 12.5L17.2 18.8L12 15.5L6.8 18.8L8.2 12.5L3.5 8.5L9.8 8.2L12 2Z" fill="currentColor" opacity="0.95" />
      <circle cx="12" cy="12" r="3" fill="#fff" opacity="0.9" />
    </svg>
  )
}

function UploadIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V6m0 0L8.5 9.5M12 6l3.5 3.5M5 18h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MicIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6 11a6 6 0 0012 0M12 17v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function StopIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
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

function AttachmentIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 12.5V7.8a3.3 3.3 0 016.6 0v6.4a2.2 2.2 0 01-4.4 0V8.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
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
  const [selectedProvider, setSelectedProvider] = useState(() => readStoredProvider())
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const [pendingFiles, setPendingFiles] = useState([])
  const [listening, setListening] = useState(false)
  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)
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
        const openaiReady = Boolean(cfg?.openai?.configured)
        const stored = readStoredProvider()
        const nextProvider = openaiReady && stored === OPENAI_PROVIDER
          ? OPENAI_PROVIDER
          : BUILTIN_PROVIDER
        setSelectedProvider(nextProvider)
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
    const chatgptReady = Boolean(aiConfig?.openai?.configured)
    const welcome = chatgptReady
      ? `Hello ${firstName}! 👋 I'm **LoopC Pro**, your built-in AI with **live company data**.\n\nTry **Analyze my company**, **Live metal prices**, **Fix last error**, or ask anything about ERP, CRM, HR, MT4.\n\n**ChatGPT** is also available in Engine above for open-ended questions.`
      : `Hello ${firstName}! 👋 I'm **LoopC Pro** — I know this **entire project** (routes, services, models, tabs) and your **live ERP/CRM data**.\n\nTry **Map project code**, **Analyze my company**, **Fix …** with any error, or upload files with the upload button.\n\nBuilt-in = free. I auto-match problems to exact code files and fix steps.`
    setMessages([{ id: 'welcome', role: 'assistant', content: welcome }])
  }, [open, firstName, messages.length, aiConfig?.openai?.configured])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sending, open])

  useEffect(() => () => {
    try {
      recognitionRef.current?.stop?.()
    } catch {
      /* ignore */
    }
  }, [])

  const addPendingFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList || [])
    if (!incoming.length) return
    setPendingFiles((prev) => {
      const merged = [...prev, ...incoming].slice(0, MAX_FILES)
      return merged
    })
  }, [])

  const removePendingFile = useCallback((index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const toggleVoiceInput = useCallback(() => {
    const SpeechRecognition = typeof window !== 'undefined'
      && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SpeechRecognition) {
      setMessages((prev) => [...prev, {
        id: `v-${Date.now()}`,
        role: 'assistant',
        content: 'Voice input is not supported in this browser. Try Chrome or Edge, or upload an audio file with 📎.',
      }])
      return
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognitionRef.current = recognition

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || '')
        .join('')
        .trim()
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    setListening(true)
    recognition.start()
  }, [listening])

  const sendMessage = useCallback(async (text, filesOverride = null) => {
    const trimmed = String(text || '').trim()
    const files = filesOverride ?? pendingFiles
    if ((!trimmed && files.length === 0) || sending) return

    const attachmentMeta = files.map((f) => ({
      name: f.name,
      size: f.size,
      kind: fileKindLabel(f),
      previewUrl: f.type?.startsWith('image/') ? URL.createObjectURL(f) : null,
    }))

    const displayContent = trimmed
      || (files.length === 1 ? `Uploaded **${files[0].name}**` : `Uploaded **${files.length} files**`)

    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: displayContent,
      attachments: attachmentMeta,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setPendingFiles([])
    setSending(true)

    const useOpenAi = selectedProvider === OPENAI_PROVIDER && openAiAvailable

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }))

      const payload = {
        message: trimmed || 'Analyze the uploaded file(s).',
        history,
        provider: useOpenAi ? OPENAI_PROVIDER : BUILTIN_PROVIDER,
        model: useOpenAi ? selectedModel : undefined,
        pageContext: {
          tab: activeTab || '',
          path: typeof window !== 'undefined' ? window.location.pathname : '',
          tenant: tenantLabel || '',
        },
        lastError: getLastApiError(),
      }

      const res = files.length
        ? await aiApi.chatWithFiles({ ...payload, files })
        : await aiApi.chat(payload)

      const meta = res?.error && res?.provider === OPENAI_PROVIDER
        ? 'ChatGPT · unavailable'
        : res?.provider === OPENAI_PROVIDER
          ? `ChatGPT · ${res?.model || selectedModel}`
          : 'LoopC · built-in Pro'

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
  }, [activeTab, messages, openAiAvailable, pendingFiles, selectedModel, selectedProvider, sending, tenantLabel])

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
                onChange={(e) => {
                  const next = e.target.value
                  setSelectedProvider(next)
                  storeProvider(next)
                }}
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
                  {m.attachments?.length ? (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {m.attachments.map((a, idx) => (
                        <div key={`${m.id}-att-${idx}`} style={{
                          fontSize: 11,
                          padding: '6px 8px',
                          borderRadius: 8,
                          background: m.role === 'user' ? 'rgba(255,255,255,0.14)' : '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                        >
                          {a.previewUrl ? (
                            <img src={a.previewUrl} alt={a.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                          ) : (
                            <span style={{ display: 'inline-flex', opacity: 0.85 }} aria-hidden>
                              <AttachmentIcon size={14} />
                            </span>
                          )}
                          <span>{a.kind}: {a.name} ({formatFileSize(a.size)})</span>
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
            style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px 8px', background: '#fff', borderTop: '1px solid #f1f5f9' }}
            onSubmit={(e) => {
              e.preventDefault()
              void sendMessage(input)
            }}
          >
            {pendingFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {pendingFiles.map((file, idx) => (
                  <div key={`pending-${file.name}-${idx}`} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                  }}
                  >
                    <span>{fileKindLabel(file)}: {file.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removePendingFile(idx)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT_UPLOAD}
                style={{ display: 'none' }}
                onChange={(e) => {
                  addPendingFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                aria-label="Upload files"
                disabled={sending || pendingFiles.length >= MAX_FILES}
                onClick={() => fileInputRef.current?.click()}
                style={attachBtnStyle}
                title="Upload document, image, audio, or video"
              >
                <UploadIcon size={18} />
              </button>
              <button
                type="button"
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                disabled={sending}
                onClick={toggleVoiceInput}
                style={{
                  ...attachBtnStyle,
                  background: listening ? '#fef2f2' : '#fff',
                  color: listening ? '#dc2626' : '#374151',
                  borderColor: listening ? '#fecaca' : '#e5e7eb',
                }}
                title="Voice to text"
              >
                {listening ? <StopIcon size={14} /> : <MicIcon size={18} />}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? 'Listening… speak now' : 'Describe a problem, ask a question, or attach files…'}
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
                disabled={sending || (!input.trim() && pendingFiles.length === 0)}
                aria-label="Send"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
                  color: '#fff',
                  cursor: sending || (!input.trim() && pendingFiles.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: sending || (!input.trim() && pendingFiles.length === 0) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                <SendIcon size={16} />
              </button>
            </div>
          </form>

          <p style={{ margin: 0, padding: '0 12px 10px', fontSize: 10, color: '#9ca3af', textAlign: 'center', background: '#fff' }}>
            {openAiAvailable
              ? 'Upload docs, images, audio, video. ChatGPT analyzes media; LoopC Pro reads text/CSV/PDF.'
              : 'Upload docs, images, audio, video. LoopC Pro extracts text from PDF/CSV/docs.'}
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

const attachBtnStyle = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#4b5563',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  padding: 0,
}
