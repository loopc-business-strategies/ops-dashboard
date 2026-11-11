import { KpiCard } from './overviewShared'
import { isPrimaryNavClick } from '../../../utils/dashboardNavigation'

export default function OverviewKpis({ cards, loading, buildTabHref, onNavigate }) {
  if (!cards.length && !loading) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <KpiCard
          key={card.id}
          title={card.title}
          value={card.value}
          hint={card.hint}
          loading={loading}
          href={card.tab && card.tab !== 'overview' ? buildTabHref?.(card.tab, card.options) : undefined}
          onClick={
            card.onClick
            || (card.tab && card.tab !== 'overview'
              ? (event) => {
                  if (event && !isPrimaryNavClick(event)) return
                  event?.preventDefault?.()
                  onNavigate?.(card.tab, card.options)
                }
              : undefined)
          }
        />
      ))}
    </div>
  )
}
