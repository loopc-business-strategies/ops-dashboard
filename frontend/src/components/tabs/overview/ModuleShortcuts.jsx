import { MODULE_SHORTCUTS, Section, TabNavLink } from './overviewShared'

export default function ModuleShortcuts({ canViewModule, canViewERP, buildTabHref, onNavigate }) {
  const items = MODULE_SHORTCUTS.filter((m) => {
    if (m.id === 'erp' || m.id === 'reports') return canViewERP
    if (m.id === 'chat') return canViewModule('chat')
    if (m.id === 'compliance') return canViewModule('government') || canViewModule('compliance')
    return canViewModule(m.id) || canViewModule(m.tab)
  })

  if (!items.length) return null

  return (
    <Section title="Module Shortcuts">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {items.map((m) => {
          if (m.href) {
            return (
              <a
                key={m.id}
                href={m.href}
                className="px-3 py-2.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-800 hover:border-gray-300 no-underline"
              >
                {m.label}
              </a>
            )
          }
          return (
            <TabNavLink
              key={m.id}
              tabId={m.tab}
              options={m.options}
              buildTabHref={buildTabHref}
              onNavigate={onNavigate}
              className="px-3 py-2.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-800 hover:border-gray-300 block no-underline"
            >
              {m.label}
            </TabNavLink>
          )
        })}
      </div>
    </Section>
  )
}
