import { KpiCard } from './overviewShared'
import { isPrimaryNavClick } from '../../../utils/dashboardNavigation'

export default function OverviewKpis({ cards, loading, buildTabHref, onNavigate }) {
  if (!cards.length && !loading) return null

  return (
    <div className="overview-kpi-grid">
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
