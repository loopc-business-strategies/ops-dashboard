import type { DashboardPayload } from '@/src/api/dashboard'
import type { ErpDashWidgetId } from '@/src/constants/erpDashboardWidgets'
import { MarginsWidget } from '@/src/components/dashboard/widgets/MarginsWidget'
import { FixingWidget } from '@/src/components/dashboard/widgets/FixingWidget'
import { BankWidget } from '@/src/components/dashboard/widgets/BankWidget'
import { ExpensesWidget } from '@/src/components/dashboard/widgets/ExpensesWidget'
import { VolumeWidget } from '@/src/components/dashboard/widgets/VolumeWidget'
import { AparWidget } from '@/src/components/dashboard/widgets/AparWidget'

type Props = {
  id: ErpDashWidgetId
  dashboard: DashboardPayload | null
  goldPriceUSD?: number
  silverPriceUSD?: number
  liveRecalcEnabled?: boolean
}

export function renderDashboardWidget({
  id,
  dashboard,
  goldPriceUSD = 0,
  silverPriceUSD = 0,
  liveRecalcEnabled = false,
}: Props) {
  switch (id) {
    case 'margins':
      return (
        <MarginsWidget
          dashboard={dashboard}
          goldPriceUSD={goldPriceUSD}
          silverPriceUSD={silverPriceUSD}
          liveRecalcEnabled={liveRecalcEnabled}
        />
      )
    case 'fixing':
      return <FixingWidget dashboard={dashboard} />
    case 'bank':
      return <BankWidget dashboard={dashboard} />
    case 'expenses':
      return <ExpensesWidget dashboard={dashboard} />
    case 'volume':
      return <VolumeWidget dashboard={dashboard} />
    case 'apar':
      return <AparWidget dashboard={dashboard} />
    default:
      return null
  }
}
