import { useMemo } from 'react'
import { useLanguage } from '../../../context/LanguageContext'
import { navigateFromNavItemId, resolveNavItemPresentation } from '../../../utils/navItemPresentation'
import { Section } from './overviewShared'

/**
 * Overview Quick Access cards driven by the user's favorites.
 */
export default function FavoritesQuickAccess({
  favorites = [],
  navItems = [],
  onNavigateToTab,
}) {
  const { t } = useLanguage()

  const rows = useMemo(() => (
    (favorites || [])
      .map((f) => resolveNavItemPresentation(f.navItemId, navItems))
      .filter((row) => row.authorized)
  ), [favorites, navItems])

  return (
    <Section title={t('quickAccess')}>
      <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>{t('quickAccessHint')}</p>
      {rows.length === 0 ? (
        <div className="favorites-quick-access-empty">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('quickAccessEmpty')}</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('manageFavoritesHint')}</p>
        </div>
      ) : (
        <div className="favorites-quick-access-grid">
          {rows.map((row) => (
            <button
              key={row.navItemId}
              type="button"
              className="favorites-quick-access-card"
              onClick={() => navigateFromNavItemId(row.navItemId, onNavigateToTab, navItems)}
            >
              <span className="favorites-quick-access-icon" aria-hidden="true">{row.icon}</span>
              <span className="favorites-quick-access-label truncate">{row.label}</span>
            </button>
          ))}
        </div>
      )}
    </Section>
  )
}
