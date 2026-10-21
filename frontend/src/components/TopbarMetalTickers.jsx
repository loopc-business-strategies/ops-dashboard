import {
  fmtMoveRow,
  fmtSpot,
  liveMetalFallbackNote,
  metalStatusSubline,
} from '../utils/liveMetalRates'
import useLiveMetalRates from '../hooks/useLiveMetalRates'
import { useLanguage } from '../context/LanguageContext'

const METALS = [
  { key: 'gold', labelKey: 'metalGold', swatch: '#FACC15', sym: 'Au', labelColor: '#92400E' },
  { key: 'silver', labelKey: 'metalSilver', swatch: '#CBD5E1', sym: 'Ag', labelColor: '#475569' },
  { key: 'platinum', labelKey: 'metalPlatinum', swatch: '#A855F7', sym: 'Pt', labelColor: '#6B21A8' },
]

const DATE_LOCALES = { en: 'en-GB', ar: 'ar', uz: 'uz-UZ', ru: 'ru-RU' }

function fillTemplate(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (
    vars[key] == null ? '' : String(vars[key])
  ))
}

/**
 * Tenant top bar: live Gold / Silver / Platinum spot from ERP metal-rates API.
 * Second row shows movement since the previous live snapshot once one exists.
 */
export default function TopbarMetalTickers() {
  const { t, langCode } = useLanguage()
  const { snapshot, error } = useLiveMetalRates()
  const fallbackNote = liveMetalFallbackNote(snapshot.source)

  return (
    <div className="topbar-metal-tickers">
      {METALS.map(({ key, labelKey, swatch, sym, labelColor }) => {
        const label = t(labelKey)
        const price = snapshot[key]
        const move = !fallbackNote && snapshot.deltas && snapshot.prevSnapshot
          ? fmtMoveRow(snapshot.deltas[key], snapshot.prevSnapshot[key])
          : null
        const when = snapshot.updatedAt
          ? new Date(snapshot.updatedAt).toLocaleString(DATE_LOCALES[langCode] || 'en-GB')
          : ''
        const updatedLabel = when ? fillTemplate(t('updatedAt'), { when }) : ''

        return (
          <div
            key={key}
            className="topbar-metal-pill"
            title={[fallbackNote, updatedLabel].filter(Boolean).join(' · ') || undefined}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: swatch,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.58rem',
                fontWeight: 800,
                color: key === 'platinum' ? '#fafafa' : '#0f172a',
                letterSpacing: '-0.02em',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
              aria-hidden
            >
              {sym}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, overflow: 'hidden', paddingRight: '0.1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(3.75rem, 1fr)', alignItems: 'baseline', gap: '0.35rem', width: '100%', lineHeight: 1.15 }}>
                <span
                  className="topbar-metal-label"
                  style={{ fontSize: '0.68rem', fontWeight: 600, color: labelColor || 'var(--text-muted)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}
                >
                  {label}
                </span>
                <span
                  className="topbar-metal-price"
                  style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {fmtSpot(price)}
                </span>
              </div>
              <div
                style={{
                  marginTop: '0.12rem',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: move ? (move.up ? 'var(--success)' : 'var(--danger)') : error || fallbackNote ? 'var(--warning)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}
              >
                {move ? (
                  <>
                    <span>{move.arrow}</span>
                    <span style={{ marginLeft: '0.15rem' }}>{move.rest}</span>
                  </>
                ) : (
                  <span>{fallbackNote && price > 0 && !error ? fallbackNote : metalStatusSubline(snapshot, price, error, key)}</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
