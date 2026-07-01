/** Light theme — Sales Manager AI tab (matches dashboard design system). */
export const SALES_AI_THEME = {
  panelBg: '#f8f9fa',
  chatBg: '#f8f9fa',
  cardBg: '#ffffff',
  cardBorder: '#e8edeb',
  textPrimary: '#1C2A33',
  textSecondary: '#3D4F58',
  textMuted: '#6b7280',
  accent: '#00684A',
  accentSoft: 'rgba(0, 104, 74, 0.08)',
  accentBorder: 'rgba(0, 104, 74, 0.35)',
  userBubble: '#00684A',
  userText: '#ffffff',
  assistantBubble: '#ffffff',
  link: '#00684A',
  errorBg: '#fff7ed',
  errorText: '#b45309',
  warningText: '#b45309',
  dangerBorder: 'rgba(248, 113, 113, 0.45)',
  dangerSoft: 'rgba(248, 113, 113, 0.12)',
  dangerText: '#dc2626',
  inputBg: '#ffffff',
  inputBorder: '#89979b',
  inputText: '#1C2A33',
  placeholder: '#6b7280',
  footerBg: '#f8f9fa',
  skeleton: 'linear-gradient(90deg, #e8edeb 25%, #f0f2f5 50%, #e8edeb 75%)',
  codeBg: '#f4f6f5',
  codeText: '#1C2A33',
  headerBg: '#ffffff',
  sendButtonBg: '#00684A',
  sendButtonText: '#ffffff',
}

export function pulseCardStyle(theme = SALES_AI_THEME) {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    background: theme.cardBg,
    border: `1px solid ${theme.cardBorder}`,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
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
