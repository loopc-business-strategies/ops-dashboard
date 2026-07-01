/** Black/white theme — Sales Manager AI tab only (not global dashboard). */
export const SALES_AI_THEME = {
  panelBg: '#000000',
  chatBg: '#000000',
  cardBg: '#0a0a0a',
  cardBorder: '#333333',
  textPrimary: '#ffffff',
  textSecondary: '#e5e5e5',
  textMuted: '#a3a3a3',
  accent: '#ffffff',
  accentSoft: 'rgba(255, 255, 255, 0.12)',
  accentBorder: 'rgba(255, 255, 255, 0.25)',
  userBubble: '#1a1a1a',
  userText: '#ffffff',
  assistantBubble: '#0a0a0a',
  link: '#ffffff',
  errorBg: '#1a1a1a',
  errorText: '#fbbf24',
  warningText: '#fbbf24',
  dangerBorder: 'rgba(248, 113, 113, 0.45)',
  dangerSoft: 'rgba(248, 113, 113, 0.12)',
  dangerText: '#fca5a5',
  inputBg: '#0a0a0a',
  inputBorder: '#404040',
  inputText: '#ffffff',
  placeholder: '#a3a3a3',
  footerBg: '#000000',
  skeleton: 'linear-gradient(90deg, #1a1a1a 25%, #333333 50%, #1a1a1a 75%)',
  codeBg: '#1a1a1a',
  codeText: '#ffffff',
  headerBg: '#000000',
  sendButtonBg: '#ffffff',
  sendButtonText: '#000000',
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
    color: theme.textPrimary,
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
    color: theme.textPrimary,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
}
