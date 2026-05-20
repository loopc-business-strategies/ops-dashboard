// FILE: src/components/tabs/PlaceholderTab.jsx
// WHAT THIS IS:
//   A reusable "coming soon" placeholder for every tab
//   that hasn't been built yet.
//   As client adds requirements, each tab gets replaced
//   with its real content.

import { useLanguage } from '../../context/LanguageContext'
import { ModulePageHeading, ModuleTabColumn } from '../layout/ModuleTabChrome'

function PlaceholderTab({ title, icon, description, subTabs = [] }) {
  const { t } = useLanguage()
  return (
    <ModuleTabColumn>
      <ModulePageHeading
        title={title}
        subtitle={description}
        right={icon ? <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-xl shadow-sm">{icon}</div> : null}
      />

      {subTabs.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{t('plannedSections')}</p>
          <div className="flex flex-wrap gap-2">
            {subTabs.map((st, i) => (
              <span
                key={i}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800"
              >
                {st}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div aria-hidden className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-emerald-500" />
            <div className="mb-3 h-8 w-8 animate-pulse rounded-lg bg-gray-100" />
            <div className="mb-2 h-3 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100/80" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-6 text-center shadow-sm">
        <p className="text-sm font-medium leading-tight text-violet-900">🔧 {t('moduleUnderConstruction')}</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">{t('builtAsRequired')}</p>
      </div>
    </ModuleTabColumn>
  )
}

export default PlaceholderTab
