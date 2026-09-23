import React from 'react'
import { Screen } from '@/src/components/ui'
import { MGFloorTabletDashboard } from '@/src/components/tablet-dashboard'

/** Single unified MG FLOOR dashboard (3 columns on all device sizes). */
export default function HomeScreen() {
  return (
    <Screen style={{ padding: 0, backgroundColor: '#FFFFFF' }}>
      <MGFloorTabletDashboard />
    </Screen>
  )
}
