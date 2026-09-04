import type { DashboardPayload } from '@/src/api/dashboard'
import type { ErpDashWidgetId } from '@/src/constants/erpDashboardWidgets'
import { MarginsWidget } from '@/src/components/dashboard/widgets/MarginsWidget'
import { FixingWidget } from '@/src/components/dashboard/widgets/FixingWidget'
import { BankWidget } from '@/src/components/dashboard/widgets/BankWidget'
import { ExpensesWidget } from '@/src/components/dashboard/widgets/ExpensesWidget'
import { ExpenseReportWidget } from '@/src/components/dashboard/widgets/ExpenseReportWidget'
import { VolumeWidget } from '@/src/components/dashboard/widgets/VolumeWidget'
import { AparWidget } from '@/src/components/dashboard/widgets/AparWidget'

type Props = {
  id: ErpDashWidgetId
  dashboard: DashboardPayload | null
  goldPriceUSD?: number
  silverPriceUSD?: number
  liveRecalcEnabled?: boolean
  refreshKey?: number | string
  baseCurrencyCode?: string
}

export function renderDashboardWidget({
  id,
  dashboard,
  goldPriceUSD = 0,
  silverPriceUSD = 0,
  liveRecalcEnabled = false,
  refreshKey = 0,
  baseCurrencyCode = 'USD',
}: Props) {
  switch (id) {
    case 'margins':
      return (
        <MarginsWidget
          dashboard={dashboard}
          goldPriceUSD={goldPriceUSD}
          silverPriceUSD={silverPriceUSD}
          liveRecalcEnabled={liveRecalcEnabled}
          baseCurrencyCode={baseCurrencyCode}
        />
      )
    case 'fixing':
      return <FixingWidget dashboard={dashboard} />
    case 'bank':
      return <BankWidget dashboard={dashboard} baseCurrencyCode={baseCurrencyCode} />
    case 'expenses':
      return <ExpensesWidget dashboard={dashboard} baseCurrencyCode={baseCurrencyCode} />
    case 'expenseReport':
      return <ExpenseReportWidget refreshKey={refreshKey} baseCurrencyCode={baseCurrencyCode} />
    case 'volume':
      return <VolumeWidget dashboard={dashboard} baseCurrencyCode={baseCurrencyCode} />
    case 'apar':
      return <AparWidget dashboard={dashboard} baseCurrencyCode={baseCurrencyCode} />
    default:
      return null
  }
}
