// FILE: src/components/tabs/PlaceholderTab.jsx
// WHAT THIS IS:
//   A reusable "coming soon" placeholder for every tab
//   that hasn't been built yet.
//   As client adds requirements, each tab gets replaced
//   with its real content.

import { useLanguage } from '../../context/LanguageContext'

function PlaceholderTab({ title, icon, description, subTabs = [] }) {
  const { t } = useLanguage()
  return (
    <div className="space-y-8 pt-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center text-xl border border-gray-700">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-white leading-tight">{title}</h3>
          <p className="text-gray-500 text-sm leading-relaxed mt-0.5">{description}</p>
        </div>
      </div>

      {/* Planned sub-tabs preview */}
      {subTabs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider leading-none">{t('plannedSections')}</p>
          <div className="flex flex-wrap gap-2">
            {subTabs.map((st, i) => (
              <span key={i}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 leading-none">
                {st}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content placeholder grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 border-dashed">
            <div className="w-8 h-8 bg-gray-700 rounded-lg mb-3 animate-pulse" />
            <div className="h-3 bg-gray-700 rounded w-3/4 mb-2 animate-pulse" />
            <div className="h-3 bg-gray-700/60 rounded w-1/2 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="p-6 bg-emerald-700/5 border border-emerald-700/20 rounded-xl text-center">
        <p className="text-violet-400 font-medium text-sm leading-tight">🔧 {t('moduleUnderConstruction')}</p>
        <p className="text-gray-500 text-xs mt-1 leading-relaxed">
          {t('builtAsRequired')}
        </p>
      </div>
    </div>
  )
}

export default PlaceholderTab
