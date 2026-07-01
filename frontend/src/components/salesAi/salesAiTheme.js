/** Dark theme tokens — Sales Manager AI widget only (not global dashboard). */
export const SALES_AI_THEME = {
  panelBg: '#111827',
  chatBg: '#0f1419',
  cardBg: '#1e2530',
  cardBorder: '#374151',
  textPrimary: '#f3f4f6',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  accent: '#22c55e',
  accentSoft: 'rgba(34, 197, 94, 0.12)',
  accentBorder: 'rgba(34, 197, 94, 0.35)',
  userBubble: '#00684A',
  userText: '#ffffff',
  assistantBubble: '#1e2530',
  link: '#6ee7b7',
  errorBg: '#422006',
  errorText: '#fbbf24',
  warningText: '#fbbf24',
  dangerBorder: 'rgba(248, 113, 113, 0.45)',
  dangerSoft: 'rgba(248, 113, 113, 0.12)',
  dangerText: '#fca5a5',
  inputBg: '#1f2937',
  inputBorder: '#4b5563',
  inputText: '#f9fafb',
  placeholder: '#6b7280',
  footerBg: '#111827',
  skeleton: 'linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%)',
  codeBg: '#374151',
  codeText: '#e5e7eb',
  headerGradient: 'linear-gradient(135deg, #00684A 0%, #13AA52 100%)',
  fabGradient: 'linear-gradient(135deg, #00684A 0%, #13AA52 55%, #00b4d8 100%)',
}

export function pulseCardStyle(theme = SALES_AI_THEME) {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    background: theme.cardBg,
    border: `1px solid ${theme.cardBorder}`,
  }
}

export function pulseSectionTitleStyle(theme = SALES_AI_THEME) {
  return {
    fontSize: 11,
    fontWeight: 700,
    color: theme.accent,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  }
}

export function pulseBodyStyle(theme = SALES_AI_THEME) {
  return {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 1.45,
  }
}

export function chipStyle(theme = SALES_AI_THEME, { disabled = false } = {}) {
  return {
    fontSize: 11,
    fontWeight: 600,
    padding: '6px 10px',
    borderRadius: 999,
    border: `1px solid ${theme.accentBorder}`,
    background: theme.accentSoft,
    color: theme.accent,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
}

export function iconBtnStyle() {
  return {
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
}
