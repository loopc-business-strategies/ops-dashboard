import { useMemo } from 'react'
import { useLanguage } from '../../../context/LanguageContext'
import { navigateFromNavItemId, resolveNavItemPresentation } from '../../../utils/navItemPresentation'
import { Section } from './overviewShared'

function StarIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.5l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 20l1-6L3.3 9.9l6-.9L12 3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
      <p className="favorites-quick-access-hint">{t('quickAccessHint')}</p>
      {rows.length === 0 ? (
        <div className="favorites-quick-access-empty">
          <span className="favorites-quick-access-empty-icon" aria-hidden="true">
            <StarIcon />
          </span>
          <p className="favorites-quick-access-empty-title">{t('favoritesEmpty')}</p>
          <p className="favorites-quick-access-empty-hint">{t('manageFavoritesHint')}</p>
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
