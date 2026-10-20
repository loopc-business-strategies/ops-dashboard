// FILE: src/components/tabs/PlaceholderTab.jsx
// WHAT THIS IS:
//   A reusable "coming soon" placeholder for every tab
//   that hasn't been built yet.
//   As client adds requirements, each tab gets replaced
//   with its real content.

import { useLanguage } from '../../context/LanguageContext'
import { ModulePageHeading, ModuleTabColumn } from '../layout/ModuleTabChrome'

function WrenchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function PlaceholderTab({ title, icon, description, subTabs = [] }) {
  const { t } = useLanguage()
  return (
    <ModuleTabColumn>
      <ModulePageHeading
        title={title}
        subtitle={description}
        right={icon ? (
          <div
            style={{
              display: 'flex',
              height: 40,
              width: 40,
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid var(--border)',
              background: 'var(--bg-card, #fff)',
              fontSize: 20,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {icon}
          </div>
        ) : null}
      />

      {subTabs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            {t('plannedSections')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {subTabs.map((st, i) => (
              <span
                key={i}
                style={{
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card, #fff)',
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {st}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 'var(--radius-lg, 12px)',
              border: '1px solid var(--border)',
              background: 'var(--bg-card, #fff)',
              padding: 20,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: 2,
                background:
                  'linear-gradient(90deg, var(--brand-accent), var(--brand-light), var(--brand-dark))',
              }}
            />
            <div
              className="animate-pulse"
              style={{
                marginBottom: 12,
                height: 32,
                width: 32,
                borderRadius: 'var(--radius-md, 8px)',
                background: 'var(--brand-soft)',
              }}
            />
            <div
              className="animate-pulse"
              style={{
                marginBottom: 8,
                height: 12,
                width: '75%',
                borderRadius: 6,
                background: 'var(--brand-soft)',
              }}
            />
            <div
              className="animate-pulse"
              style={{
                height: 12,
                width: '50%',
                borderRadius: 6,
                background: 'var(--brand-soft)',
                opacity: 0.85,
              }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--brand-border)',
          background: 'var(--brand-soft)',
          padding: '1.5rem',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <p
          style={{
            margin: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.25,
            color: 'var(--brand-on-soft)',
          }}
        >
          <WrenchIcon />
          {t('moduleUnderConstruction')}
        </p>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}
        >
          {t('builtAsRequired')}
        </p>
      </div>
    </ModuleTabColumn>
  )
}

export default PlaceholderTab
